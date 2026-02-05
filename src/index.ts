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

    // Extract team - get full team name from href
    const team = await page.evaluate(() => {
      const teamLink = (document as any).querySelector('a[data-clubhouse-uid]');
      if (!teamLink) return '';
      const href = teamLink.href || '';
      // Extract full team name from URL like '/team/_/name/mil/milwaukee-bucks'
      const match = href.match(/\/name\/[^\/]+\/([^?\/]+)/);
      if (match) {
        // Convert 'milwaukee-bucks' to 'Milwaukee Bucks'
        return match[1].split('-').map((word: string) => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
      }
      return teamLink.textContent?.trim() || '';
    }).catch(() => '');
    if (team) {
      enrichedData['ESPN Team'] = team;
      console.log(`    📊 Team: ${team}`);
    }

    // Extract headshot - look for image with /i/headshots/ in src
    const headshot = await page.evaluate(() => {
      const imgs = Array.from((document as any).querySelectorAll('img'));
      const headshotImg = imgs.find((img: any) => img.src && img.src.includes('/i/headshots/'));
      return headshotImg ? (headshotImg as HTMLImageElement).src : '';
    }).catch(() => '');
    if (headshot) {
      enrichedData['ESPN Headshot'] = headshot;
      console.log(`    📸 Headshot found`);
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

    // Extract player status
    const status = await page.evaluate(() => {
      const statusEl = (document as any).querySelector('.TextStatus');
      return statusEl?.textContent?.trim() || 'Active';
    }).catch(() => 'Active');
    if (status !== 'Active') {
      enrichedData['ESPN Player Status'] = status;
    }

    // Extract biographical information from bio list
    const bioData: { [key: string]: string } = await page.evaluate(() => {
      const bioItems: { [key: string]: string } = {};
      
      const bioList = (document as any).querySelectorAll('.PlayerHeader__Bio_List li');
      bioList.forEach((item: any) => {
        const text = item.textContent?.trim() || '';
        
        // Parse HT/WT: "HT/WT2.11 m, 110 kg"
        if (text.startsWith('HT/WT')) {
          const htwtText = text.replace('HT/WT', '').trim();
          const parts = htwtText.split(',');
          if (parts[0]) bioItems.height = parts[0].trim();
          if (parts[1]) bioItems.weight = parts[1].trim();
        }
        // Parse Birthdate: "Birthdate6/12/1994 (31)"
        else if (text.startsWith('Birthdate')) {
          const ageMatch = text.match(/\((\d+)\)/);
          if (ageMatch) bioItems.age = ageMatch[1];
        }
        // Parse College if mentioned
        else if (text.toLowerCase().includes('college:')) {
          bioItems.college = text.replace(/College:?/i, '').trim();
        }
      });

      return bioItems;
    }).catch(() => ({}));

    if (bioData.age) {
      enrichedData['ESPN Age'] = bioData.age;
      console.log(`    📊 Age: ${bioData.age}`);
    }
    if (bioData.height) {
      enrichedData['ESPN Height'] = bioData.height;
      console.log(`    📊 Height: ${bioData.height}`);
    }
    if (bioData.weight) {
      enrichedData['ESPN Weight'] = bioData.weight + (bioData.weight.match(/\d+$/) ? ' lbs' : '');
      console.log(`    📊 Weight: ${bioData.weight}`);
    }
    if (bioData.college) {
      enrichedData['ESPN College'] = bioData.college;
      console.log(`    📊 College: ${bioData.college}`);
    }
    
    // Debug: Log what bio data was found
    console.log(`    🔍 Bio data found:`, bioData);

    // Navigate to bio page for career highlights and history
    const bioUrl = espnLink.replace('/player/_/', '/player/bio/_/');
    console.log(`    Navigating to bio page: ${bioUrl}`);
    
    await page.goto(bioUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    }).catch(() => {
      console.log('    Bio page load timed out, continuing...');
    });

    // Extract career highlights from bio page
    const careerHighlights = await page.evaluate(() => {
      const highlights: string[] = [];
      
      const highlightItems = (document as any).querySelectorAll('.Career__Highlights__Item');
      highlightItems.forEach((item: any) => {
        const content = item.querySelector('.Career__Highlights__Item__Content');
        const title = content?.querySelector('.clr-black')?.textContent?.trim();
        const years = content?.querySelector('.clr-gray-05')?.textContent?.trim();
        if (title) {
          highlights.push(years ? `${title} (${years})` : title);
        }
      });

      return highlights;
    }).catch(() => []);

    if (careerHighlights.length > 0) {
      enrichedData['ESPN Career Highlights'] = careerHighlights.join('\n');
      console.log(`    🏆 Career Highlights: ${careerHighlights.length} awards found`);
    }

    // Extract career history from bio page
    const careerHistory = await page.evaluate(() => {
      const history: string[] = [];
      
      const historyItems = (document as any).querySelectorAll('.Career__History__Item');
      historyItems.forEach((item: any) => {
        const teamName = item.querySelector('.clr-black')?.textContent?.trim();
        const years = item.querySelector('.clr-gray-05')?.textContent?.trim();
        if (teamName && years) {
          history.push(`${teamName}: ${years}`);
        }
      });

      return history;
    }).catch(() => []);

    if (careerHistory.length > 0) {
      enrichedData['ESPN Career History'] = careerHistory.join('\n');
      console.log(`    📜 Career History: ${careerHistory.length} teams found`);
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
