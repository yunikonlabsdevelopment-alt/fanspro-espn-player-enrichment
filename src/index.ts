import Airtable from 'airtable';
import puppeteer from 'puppeteer';

// Airtable configuration
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const AIRTABLE_PLAYERS_TABLE_ID = process.env.AIRTABLE_PLAYERS_TABLE_ID!;
const ESPN_VIEW_ID = 'viwExtQmSJeSQR48C'; // ESPN Data view

// Initialize Airtable
const base = new Airtable({ apiKey: AIRTABLE_TOKEN }).base(AIRTABLE_BASE_ID);

interface EnrichedData {
  'ESPN Team'?: string;
  'ESPN Headshot'?: string;
  'ESPN Number'?: string;
  'ESPN Position'?: string;
  'ESPN Player Status'?: string;
  'ESPN Career Highlights'?: string;
  'ESPN Career History'?: string;
  'ESPN Age'?: string;
  'ESPN Height'?: string;
  'ESPN Weight'?: string;
  'ESPN College'?: string;
  'ESPN Data Status': string;
  'ESPN Last Check': string;
  'ESPN Updates': string;
}

interface PlayerRecord {
  id: string;
  fields: {
    'URL ESPN Link'?: string;
    [key: string]: any;
  };
}

// Function to enrich a single player profile
async function enrichPlayerProfile(espnLink: string, existingFields: any): Promise<EnrichedData> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log(`    Navigating to: ${espnLink}`);
    const response = await page.goto(espnLink, {
      waitUntil: 'networkidle2',
      timeout: 30000
    }).catch(() => {
      console.log('    Page load timed out, continuing...');
      return null;
    });

    // Check for 404
    if (response && response.status() === 404) {
      throw new Error('404 - Page not found');
    }

    // Wait for player card to load
    await page.waitForSelector('.PlayerHeader__Bio', { timeout: 10000 }).catch(() => {
      console.log('    Player bio section not found, trying alternative selectors...');
    });

    // Extract player data
    const enrichedData: EnrichedData = {
      'ESPN Data Status': 'Complete',
      'ESPN Last Check': new Date().toISOString().split('T')[0],
      'ESPN Updates': ''
    };

    // Extract team
    const team = await page.evaluate(() => {
      const teamLink = (document as any).querySelector('.PlayerHeader__Team a');
      return teamLink?.textContent?.trim() || '';
    }).catch(() => '');
    if (team) enrichedData['ESPN Team'] = team;

    // Extract headshot
    const headshot = await page.evaluate(() => {
      const img = (document as any).querySelector('.PlayerHeader__Headshot img, .Image__Wrapper img');
      return img?.src || '';
    }).catch(() => '');
    if (headshot && !headshot.includes('default')) {
      enrichedData['ESPN Headshot'] = headshot;
    }

    // Extract number and position from header
    const numberPosition = await page.evaluate(() => {
      const numberEl = (document as any).querySelector('.PlayerHeader__Number');
      const positionEl = (document as any).querySelector('.PlayerHeader__Position');
      return {
        number: numberEl?.textContent?.replace('#', '').trim() || '',
        position: positionEl?.textContent?.trim() || ''
      };
    }).catch(() => ({ number: '', position: '' }));

    if (numberPosition.number) enrichedData['ESPN Number'] = numberPosition.number;
    if (numberPosition.position) enrichedData['ESPN Position'] = numberPosition.position;

    // Extract player status (active/inactive)
    const status = await page.evaluate(() => {
      const statusEl = (document as any).querySelector('.PlayerHeader__Status, .status-text');
      return statusEl?.textContent?.trim() || 'Active';
    }).catch(() => 'Active');
    enrichedData['ESPN Player Status'] = status;

    // Extract biographical information
    const bioData: { [key: string]: string } = await page.evaluate(() => {
      const bioItems: { [key: string]: string } = {};
      
      // Find all bio list items
      const bioList = (document as any).querySelectorAll('.PlayerHeader__Bio_List li, .player-bio li');
      bioList.forEach((item: any) => {
        const text = item.textContent?.trim() || '';
        
        // Parse different bio fields
        if (text.toLowerCase().includes('age:') || text.match(/^Age\s+\d+/i)) {
          bioItems.age = text.replace(/Age:?/i, '').trim();
        } else if (text.toLowerCase().includes('born:')) {
          // Calculate age from birthdate if available
          const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
          if (dateMatch) {
            const birthDate = new Date(dateMatch[1]);
            const today = new Date();
            const age = Math.floor((today.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
            bioItems.age = age.toString();
          }
        } else if (text.toLowerCase().includes('height:') || text.match(/^\d+'\d+"/)) {
          bioItems.height = text.replace(/Height:?/i, '').trim();
        } else if (text.toLowerCase().includes('weight:') || text.match(/^\d+\s*(lbs?|pounds?)/i)) {
          bioItems.weight = text.replace(/Weight:?/i, '').replace(/lbs?|pounds?/i, '').trim();
        } else if (text.toLowerCase().includes('college:')) {
          bioItems.college = text.replace(/College:?/i, '').trim();
        } else if (text.toLowerCase().includes('school:')) {
          bioItems.college = text.replace(/School:?/i, '').trim();
        }
      });

      // Alternative selectors for bio data
      if (!bioItems.height) {
        const heightEl = (document as any).querySelector('[data-id="height"], .height-value');
        if (heightEl) bioItems.height = heightEl.textContent?.trim() || '';
      }
      if (!bioItems.weight) {
        const weightEl = (document as any).querySelector('[data-id="weight"], .weight-value');
        if (weightEl) bioItems.weight = weightEl.textContent?.trim() || '';
      }
      if (!bioItems.college) {
        const collegeEl = (document as any).querySelector('[data-id="college"], .college-value');
        if (collegeEl) bioItems.college = collegeEl.textContent?.trim() || '';
      }

      return bioItems;
    }).catch(() => ({}));

    if (bioData.age) enrichedData['ESPN Age'] = bioData.age;
    if (bioData.height) enrichedData['ESPN Height'] = bioData.height;
    if (bioData.weight) enrichedData['ESPN Weight'] = bioData.weight + (bioData.weight.match(/\d+$/) ? ' lbs' : '');
    if (bioData.college) enrichedData['ESPN College'] = bioData.college;

    // Extract career highlights/awards
    const careerHighlights = await page.evaluate(() => {
      const highlights: string[] = [];
      
      // Look for awards section
      const awardsSection = (document as any).querySelector('.player-awards, .PlayerAwards, [class*="Awards"]');
      if (awardsSection) {
        const awards = awardsSection.querySelectorAll('.award-item, .award, li');
        awards.forEach((award: any) => {
          const text = award.textContent?.trim();
          if (text) highlights.push(text);
        });
      }

      // Look for accolades
      const accoladesSection = (document as any).querySelector('.accolades, .player-accolades');
      if (accoladesSection) {
        const items = accoladesSection.querySelectorAll('li, .accolade');
        items.forEach((item: any) => {
          const text = item.textContent?.trim();
          if (text && !highlights.includes(text)) highlights.push(text);
        });
      }

      return highlights;
    }).catch(() => []);

    if (careerHighlights.length > 0) {
      enrichedData['ESPN Career Highlights'] = careerHighlights.join('\n');
    }

    // Extract career history/experience
    const careerHistory = await page.evaluate(() => {
      const history: string[] = [];
      
      // Look for experience/team history section
      const experienceSection = (document as any).querySelector('.player-experience, .PlayerExperience, [class*="Experience"]');
      if (experienceSection) {
        const teams = experienceSection.querySelectorAll('.team-item, .experience-item, li');
        teams.forEach((team: any) => {
          const text = team.textContent?.trim();
          if (text) history.push(text);
        });
      }

      // Alternative: look for team history
      const teamHistory = (document as any).querySelectorAll('.team-history li, .career-history li');
      teamHistory.forEach((item: any) => {
        const text = item.textContent?.trim();
        if (text && !history.includes(text)) history.push(text);
      });

      return history;
    }).catch(() => []);

    if (careerHistory.length > 0) {
      enrichedData['ESPN Career History'] = careerHistory.join('\n');
    }

    // Track which fields were updated
    const updatedFields: string[] = [];
    const oldData = existingFields || {};

    for (const key of Object.keys(enrichedData)) {
      if (key !== 'ESPN Data Status' && key !== 'ESPN Last Check' && key !== 'ESPN Updates') {
        const newValue = enrichedData[key as keyof EnrichedData];
        const oldValue = oldData[key];
        
        if (newValue && newValue !== oldValue) {
          updatedFields.push(key);
        }
      }
    }

    // Determine status based on whether data changed
    let hasChanges = false;
    if (oldData) {
      for (const key of Object.keys(enrichedData)) {
        if (key !== 'ESPN Data Status' && key !== 'ESPN Last Check' && key !== 'ESPN Updates') {
          if (enrichedData[key as keyof EnrichedData] !== oldData[key]) {
            hasChanges = true;
            break;
          }
        }
      }
    } else {
      hasChanges = updatedFields.length > 0;
    }

    enrichedData['ESPN Data Status'] = hasChanges ? 'Updated' : 'Complete';
    enrichedData['ESPN Updates'] = updatedFields.length > 0 
      ? `Updated fields: ${updatedFields.join(', ')}`
      : 'No changes detected';

    console.log(`    ✅ Extracted ${Object.keys(enrichedData).filter(k => enrichedData[k as keyof EnrichedData] && !['ESPN Data Status', 'ESPN Last Check', 'ESPN Updates'].includes(k)).length} data points`);
    
    return enrichedData;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`    ❌ Error: ${errorMessage}`);
    
    return {
      'ESPN Data Status': errorMessage.includes('404') ? 'Not Found' : 'Error',
      'ESPN Last Check': new Date().toISOString().split('T')[0],
      'ESPN Updates': errorMessage
    };
  } finally {
    await browser.close();
  }
}

// Function to batch update Airtable
async function batchUpdateAirtable(updates: Array<{ id: string; fields: EnrichedData }>) {
  if (updates.length === 0) return;

  try {
    await base(AIRTABLE_PLAYERS_TABLE_ID).update(updates as any);
    console.log(`📤 Updated batch of ${updates.length} records...`);
  } catch (error) {
    console.error(`❌ Error updating batch:`, error);
  }
}

// Main function
async function main() {
  console.log('🏀 Starting ESPN Player Enrichment\n');

  try {
    // Fetch all players with ESPN links from the ESPN Data view
    console.log('📥 Fetching players from Airtable ESPN Data view...');
    const players: PlayerRecord[] = [];
    
    await base(AIRTABLE_PLAYERS_TABLE_ID)
      .select({
        view: ESPN_VIEW_ID,
        filterByFormula: `AND({URL ESPN Link} != '', {URL ESPN Link} != BLANK())`
      })
      .eachPage((records, fetchNextPage) => {
        records.forEach(record => {
          players.push({
            id: record.id,
            fields: record.fields as any
          });
        });
        fetchNextPage();
      });

    console.log(`Found ${players.length} players to enrich\n`);

    if (players.length === 0) {
      console.log('No players found with ESPN links. Exiting.');
      return;
    }

    const batchUpdates: Array<{ id: string; fields: EnrichedData }> = [];

    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const espnLink = player.fields['URL ESPN Link'];

      if (!espnLink) {
        console.log(`[${i + 1}/${players.length}] Skipping - no ESPN link`);
        continue;
      }

      const playerName = player.fields['Name'] || 'Unknown Player';
      const progress = Math.round(((i + 1) / players.length) * 100);
      
      console.log(`[${i + 1}/${players.length}] (${progress}%) Processing ${playerName}...`);

      try {
        const enrichedData = await enrichPlayerProfile(espnLink, player.fields);
        batchUpdates.push({
          id: player.id,
          fields: enrichedData
        });

        // Update every 10 records or at the end
        if (batchUpdates.length === 10 || i === players.length - 1) {
          await batchUpdateAirtable(batchUpdates);
          batchUpdates.length = 0; // Clear the array
        }

      } catch (error) {
        console.error(`  ❌ Failed to process ${playerName}:`, error);
      }

      // Small delay between requests
      if (i < players.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`\n✨ Complete! Enriched ${players.length} players`);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main();
