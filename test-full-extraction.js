const puppeteer = require('puppeteer');

(async () => {
  console.log('Testing full ESPN extraction with correct selectors...\n');
  
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  const espnLink = 'https://www.espn.com.au/nba/player/_/id/3032977/giannis-antetokounmpo';
  
  console.log(`1. Navigating to main page: ${espnLink}`);
  await page.goto(espnLink, { waitUntil: 'networkidle2' });
  
  // Extract all main page data
  const mainPageData = await page.evaluate(() => {
    const data = {};
    
    // Team - get full name from href
    const teamLink = document.querySelector('a[data-clubhouse-uid]');
    if (teamLink) {
      const href = teamLink.href || '';
      const match = href.match(/\/name\/[^\/]+\/([^?\/]+)/);
      if (match) {
        data.team = match[1].split('-').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
      } else {
        data.team = teamLink.textContent?.trim();
      }
    }
    
    // Headshot
    const imgs = Array.from(document.querySelectorAll('img'));
    const headshotImg = imgs.find(img => img.src && img.src.includes('/i/headshots/'));
    if (headshotImg) data.headshot = headshotImg.src;
    
    // Status
    const statusEl = document.querySelector('.TextStatus');
    data.status = statusEl?.textContent?.trim() || 'Active';
    
    // Bio items
    const bioItems = Array.from(document.querySelectorAll('.PlayerHeader__Bio_List li'));
    data.bioItems = bioItems.map(item => item.textContent?.trim());
    
    // Parse bio items
    bioItems.forEach(item => {
      const text = item.textContent?.trim() || '';
      
      if (text.startsWith('HT/WT')) {
        const htwtText = text.replace('HT/WT', '').trim();
        const parts = htwtText.split(',');
        if (parts[0]) data.height = parts[0].trim();
        if (parts[1]) data.weight = parts[1].trim();
      }
      else if (text.startsWith('Birthdate')) {
        const ageMatch = text.match(/\((\d+)\)/);
        if (ageMatch) data.age = ageMatch[1];
      }
    });
    
    return data;
  });
  
  console.log('Main Page Data:');
  console.log(JSON.stringify(mainPageData, null, 2));
  
  // Navigate to bio page
  const bioUrl = espnLink.replace('/player/_/', '/player/bio/_/');
  console.log(`\n2. Navigating to bio page: ${bioUrl}`);
  await page.goto(bioUrl, { waitUntil: 'networkidle2' });
  
  // Extract bio page data
  const bioPageData = await page.evaluate(() => {
    const data = {};
    
    // Career highlights
    const highlightItems = Array.from(document.querySelectorAll('.Career__Highlights__Item'));
    data.careerHighlights = highlightItems.map(item => {
      const content = item.querySelector('.Career__Highlights__Item__Content');
      const title = content?.querySelector('.clr-black')?.textContent?.trim();
      const years = content?.querySelector('.clr-gray-05')?.textContent?.trim();
      return years ? `${title} (${years})` : title;
    }).filter(Boolean);
    
    // Career history
    const historyItems = Array.from(document.querySelectorAll('.Career__History__Item'));
    data.careerHistory = historyItems.map(item => {
      const teamName = item.querySelector('.clr-black')?.textContent?.trim();
      const years = item.querySelector('.clr-gray-05')?.textContent?.trim();
      return teamName && years ? `${teamName}: ${years}` : null;
    }).filter(Boolean);
    
    return data;
  });
  
  console.log('\nBio Page Data:');
  console.log(JSON.stringify(bioPageData, null, 2));
  
  console.log('\n=== SUMMARY ===');
  console.log(`ESPN Team: ${mainPageData.team || 'NOT FOUND'}`);
  console.log(`ESPN Headshot: ${mainPageData.headshot ? 'FOUND' : 'NOT FOUND'}`);
  console.log(`ESPN Player Status: ${mainPageData.status || 'NOT FOUND'}`);
  console.log(`ESPN Height: ${mainPageData.height || 'NOT FOUND'}`);
  console.log(`ESPN Weight: ${mainPageData.weight || 'NOT FOUND'}`);
  console.log(`ESPN Age: ${mainPageData.age || 'NOT FOUND'}`);
  console.log(`ESPN Career Highlights: ${bioPageData.careerHighlights?.length || 0} awards`);
  console.log(`ESPN Career History: ${bioPageData.careerHistory?.length || 0} teams`);
  
  await browser.close();
  console.log('\nTest complete!');
})();
