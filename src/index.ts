import Airtable from 'airtable';
import puppeteer from 'puppeteer';

// Dev tracking configuration
const DEV_BASE_ID = 'appvOK60xuHCw3Fdz';
const DEV_TABLE_ID = 'tblL3VDqpRQxWzYCc';
const DEV_RECORD_ID = 'rec8oGLTdpOonJ425';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const TODOIST_TOKEN = process.env.TODOIST_TOKEN;
const TODOIST_PROJECT_ID = process.env.TODOIST_PROJECT_ID || '2340420832';

function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  return `${year}-${month}-${day} ${hours}:${minutes}${ampm}`;
}

// Airtable configuration
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const AIRTABLE_PLAYERS_TABLE_ID = process.env.AIRTABLE_PLAYERS_TABLE_ID!;
const ESPN_VIEW_ID = 'viwExtQmSJeSQR48C'; // ESPN Data view

// Initialize Airtable
const base = new Airtable({ apiKey: AIRTABLE_TOKEN }).base(AIRTABLE_BASE_ID);

async function sendSlackMessage(message: string): Promise<void> {
  if (!SLACK_WEBHOOK_URL) return;
  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message })
    });
  } catch (error) {
    console.error('Failed to send Slack message:', error);
  }
}

async function createTodoistTask(title: string, description: string): Promise<void> {
  if (!TODOIST_TOKEN) return;
  try {
    await fetch('https://api.todoist.com/rest/v2/tasks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TODOIST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: title,
        description: description,
        project_id: TODOIST_PROJECT_ID,
        priority: 4
      })
    });
  } catch (error) {
    console.error('Failed to create Todoist task:', error);
  }
}

async function updateDevTracking(
  status: 'Running' | 'Complete',
  recordsTodo: number,
  recordsDone: number,
  runDetails: string
): Promise<void> {
  if (!AIRTABLE_TOKEN) return;
  try {
    // First, get the existing Run Details
    const getResponse = await fetch(
      `https://api.airtable.com/v0/${DEV_BASE_ID}/${DEV_TABLE_ID}/${DEV_RECORD_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const existingRecord: any = await getResponse.json();
    const existingDetails = existingRecord.fields?.['Run Details'] || '';
    
    // Prepend new details to existing ones
    const updatedDetails = existingDetails ? `${runDetails}\n${existingDetails}` : runDetails;
    
    await fetch(
      `https://api.airtable.com/v0/${DEV_BASE_ID}/${DEV_TABLE_ID}/${DEV_RECORD_ID}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: {
            'Run Status': status,
            'Records Todo': recordsTodo,
            'Records Done': recordsDone,
            'Run Details': updatedDetails
          }
        })
      }
    );
  } catch (error) {
    console.error('Failed to update dev tracking:', error);
  }
}

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

    // Team and position will be extracted from bio page

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

    // Extract number from bio list (format: #7)
    const number = await page.evaluate(() => {
      const bioListItems = (document as any).querySelectorAll('.PlayerHeader__Bio_List li');
      for (const item of bioListItems) {
        const text = item.textContent?.trim() || '';
        if (text.startsWith('#')) {
          return text.replace('#', '').trim();
        }
      }
      return '';
    }).catch(() => '');

    if (number) {
      enrichedData['ESPN Number'] = number;
      console.log(`    📊 Number: #${number}`);
    }

    // Extract player status
    const status = await page.evaluate(() => {
      const statusEl = (document as any).querySelector('.TextStatus');
      return statusEl?.textContent?.trim() || 'Active';
    }).catch(() => 'Active');
    // Convert to title case and always populate
    const titleCaseStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    enrichedData['ESPN Player Status'] = titleCaseStatus;

    // Extract college from main page (if available)
    const bioData: { [key: string]: string } = await page.evaluate(() => {
      const bioItems: { [key: string]: string } = {};
      
      const bioList = (document as any).querySelectorAll('.PlayerHeader__Bio_List li');
      bioList.forEach((item: any) => {
        // Extract college from link
        const collegeLink = item.querySelector('a[data-clubhouse-uid][href*="college-basketball"]');
        if (collegeLink) {
          bioItems.college = collegeLink.textContent?.trim() || '';
        }
      });

      return bioItems;
    }).catch(() => ({}));

    if (bioData.college) {
      enrichedData['ESPN College'] = bioData.college;
      console.log(`    🎓 College: ${bioData.college}`);
    }

    // Navigate to bio page for all other data
    const bioUrl = espnLink.replace('/player/_/', '/player/bio/_/');
    console.log(`    Navigating to bio page: ${bioUrl}`);
    
    await page.goto(bioUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    }).catch(() => {
      console.log('    Bio page load timed out, continuing...');
    });

    // Extract all bio data from structured Bio__Item elements on bio page
    const bioPageData = await page.evaluate(() => {
      const data: any = {};
      
      // Extract data from Bio__Item elements with labels
      const bioItems = (document as any).querySelectorAll('.Bio__Item');
      bioItems.forEach((item: any) => {
        const label = item.querySelector('.Bio__Label')?.textContent?.trim().toLowerCase();
        const valueSpan = item.querySelector('.dib.flex-uniform.mr3.clr-gray-01');
        
        if (!label || !valueSpan) return;
        
        const text = valueSpan.textContent?.trim() || '';
        
        // Team - may have link or just text
        if (label === 'team') {
          const teamLink = valueSpan.querySelector('a');
          data.team = teamLink ? teamLink.textContent?.trim() : text;
        }
        // Position
        else if (label === 'position') {
          data.position = text;
        }
        // HT/WT: "2.11 m, 110 kg"
        else if (label === 'ht/wt') {
          const parts = text.split(',');
          if (parts[0]) {
            const heightMatch = parts[0].trim().match(/([\d.]+)/);
            if (heightMatch) {
              const heightInMeters = parseFloat(heightMatch[1]);
              data.height = Math.round(heightInMeters * 100).toString();
            }
          }
          if (parts[1]) {
            const weightMatch = parts[1].trim().match(/(\d+)/);
            if (weightMatch) {
              data.weight = weightMatch[1];
            }
          }
        }
        // Birthdate: "6/12/1994 (31)"
        else if (label === 'birthdate') {
          const dateMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (dateMatch) {
            const [, day, month, year] = dateMatch;
            data.birthdate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
          const ageMatch = text.match(/\((\d+)\)/);
          if (ageMatch) {
            data.age = ageMatch[1];
          }
        }
        // Draft Info: "2013: Rd 1, Pk 15 (MIL)"
        else if (label === 'draft info') {
          data.draftInfo = text;
        }
        // Birthplace: "Athens, Greece" or "Suitland, MD"
        else if (label === 'birthplace') {
          data.birthplace = text;
        }
        // College (sometimes in bio items)
        else if (label === 'college' || label === 'school') {
          const collegeLink = valueSpan.querySelector('a');
          data.college = collegeLink ? collegeLink.textContent?.trim() : text;
        }
      });
      
      return data;
    }).catch(() => ({}));

    if (bioPageData.team) {
      enrichedData['ESPN Team'] = bioPageData.team;
      console.log(`    📊 Team: ${bioPageData.team}`);
    }
    if (bioPageData.position) {
      enrichedData['ESPN Position'] = bioPageData.position;
      console.log(`    📊 Position: ${bioPageData.position}`);
    }
    if (bioPageData.height) {
      enrichedData['ESPN Height'] = bioPageData.height;
      console.log(`    📊 Height: ${bioPageData.height} cm`);
    }
    if (bioPageData.weight) {
      enrichedData['ESPN Weight'] = bioPageData.weight;
      console.log(`    📊 Weight: ${bioPageData.weight} kg`);
    }
    if (bioPageData.age) {
      enrichedData['ESPN Age'] = bioPageData.age;
      console.log(`    📊 Age: ${bioPageData.age}`);
    }
    if (bioPageData.birthplace) {
      enrichedData['ESPN Birthplace'] = bioPageData.birthplace;
      console.log(`    📍 Birthplace: ${bioPageData.birthplace}`);
    }
    if (bioPageData.birthdate) {
      enrichedData['ESPN Birthdate'] = bioPageData.birthdate;
      console.log(`    📅 Birthdate: ${bioPageData.birthdate}`);
    }
    if (bioPageData.draftInfo) {
      enrichedData['ESPN Draft Info'] = bioPageData.draftInfo;
      console.log(`    🎯 Draft: ${bioPageData.draftInfo}`);
    }
    if (bioPageData.college) {
      enrichedData['ESPN College'] = bioPageData.college;
      console.log(`    🎓 College: ${bioPageData.college}`);
    }

    // Extract and format career highlights
    const careerHighlights = await page.evaluate(() => {
      const highlights: Array<{title: string, years: string}> = [];
      
      const highlightItems = (document as any).querySelectorAll('.Career__Highlights__Item');
      highlightItems.forEach((item: any) => {
        const content = item.querySelector('.Career__Highlights__Item__Content');
        const title = content?.querySelector('.clr-black')?.textContent?.trim();
        const years = content?.querySelector('.clr-gray-05')?.textContent?.trim();
        if (title && years) {
          highlights.push({ title, years });
        }
      });

      return highlights;
    }).catch(() => []);

    if (careerHighlights.length > 0) {
      // Format: YEAR | Award (one per year)
      const formattedHighlights: string[] = [];
      careerHighlights.forEach(highlight => {
        // Extract years from format like "2025, 2024, 2023, 2022, 2021, 2020, 2019"
        const yearMatches = highlight.years.match(/\d{4}/g);
        if (yearMatches) {
          yearMatches.forEach(year => {
            formattedHighlights.push(`${year} | ${highlight.title}`);
          });
        }
      });
      
      enrichedData['ESPN Career Highlights'] = formattedHighlights.join('\n');
      console.log(`    🏆 Career Highlights: ${formattedHighlights.length} awards found`);
    }

    // Extract and format career history
    const careerHistory = await page.evaluate(() => {
      const history: Array<{team: string, years: string}> = [];
      
      const historyItems = (document as any).querySelectorAll('.Career__History__Item');
      historyItems.forEach((item: any) => {
        const teamName = item.querySelector('.clr-black')?.textContent?.trim();
        const years = item.querySelector('.clr-gray-05')?.textContent?.trim();
        if (teamName && years) {
          history.push({ team: teamName, years });
        }
      });

      return history;
    }).catch(() => []);

    if (careerHistory.length > 0) {
      // Format: YEAR | Team (one per year or year range)
      const formattedHistory: string[] = [];
      careerHistory.forEach(item => {
        // Parse years - formats: "2019-CURRENT", "2011-2018", "2018" 
        const yearsMatch = item.years.match(/(\d{4})(?:-(\d{4}|CURRENT))?/);
        if (yearsMatch) {
          const startYear = parseInt(yearsMatch[1]);
          const endPart = yearsMatch[2];
          
          if (endPart === 'CURRENT') {
            // Current team - just show start year
            formattedHistory.push(`${startYear} | ${item.team}`);
          } else if (endPart) {
            // Year range - show start year only (most recent team connection)
            formattedHistory.push(`${startYear} | ${item.team}`);
          } else {
            // Single year
            formattedHistory.push(`${startYear} | ${item.team}`);
          }
        }
      });
      
      enrichedData['ESPN Career History'] = formattedHistory.join('\n');
      console.log(`    📜 Career History: ${formattedHistory.length} teams found`);
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

    // Start tracking
    const startDate = new Date();
    const runDetails = `${formatDateTime(startDate)} - Running - Records to do (${players.length})`;
    await updateDevTracking('Running', players.length, 0, runDetails);
    await sendSlackMessage(`🚀 *ESPN Player Enrichment Started*\nRecords: ${players.length}\nTime: ${formatDateTime(startDate)}`);

    const batchUpdates: Array<{ id: string; fields: EnrichedData }> = [];
    let processedCount = 0;

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
        processedCount++;

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

    // Complete tracking
    const endDate = new Date();
    const completeDetails = `${formatDateTime(endDate)} - Complete - Processed ${processedCount} records`;
    await updateDevTracking('Complete', 0, processedCount, completeDetails);
    await sendSlackMessage(`✅ *ESPN Player Enrichment Complete*\nProcessed: ${processedCount}\nTime: ${formatDateTime(endDate)}`);

    console.log(`\n✨ Complete! Enriched ${players.length} players`);

  } catch (error) {
    console.error('Fatal error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    await sendSlackMessage(`❌ *ESPN Player Enrichment Failed*\nError: ${errorMsg}\nTime: ${formatDateTime(new Date())}`);
    await createTodoistTask(
      '🚨 ESPN Player Enrichment Error',
      `Error: ${errorMsg}\n\nStack: ${errorStack}\n\nTime: ${new Date().toISOString()}`
    );
    process.exit(1);
  }
}

// Run the script
main();
