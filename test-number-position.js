const puppeteer = require('puppeteer');

(async () => {
  console.log('Testing number and position extraction...\n');
  
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://www.espn.com.au/nba/player/_/id/3032977/giannis-antetokounmpo', {
    waitUntil: 'networkidle2'
  });
  
  const data = await page.evaluate(() => {
    const bioListItems = document.querySelectorAll('.PlayerHeader__Bio_List li');
    const items = [];
    let number = '';
    let position = '';
    
    bioListItems.forEach((item) => {
      const text = item.textContent?.trim() || '';
      items.push(text);
      
      // Number starts with #
      if (text.startsWith('#')) {
        number = text.replace('#', '').trim();
      }
      // Position is single letter or letters (F, G, C, PG, etc) without other context
      else if (text.match(/^[A-Z]{1,2}$/)) {
        position = text;
      }
    });
    
    // Also check for status
    const statusEl = document.querySelector('.TextStatus');
    const status = statusEl?.textContent?.trim() || 'Active';
    
    return { items, number, position, status };
  });
  
  console.log('Bio List Items:', data.items);
  console.log('\nExtracted:');
  console.log(`  Number: ${data.number || 'NOT FOUND'}`);
  console.log(`  Position: ${data.position || 'NOT FOUND'}`);
  console.log(`  Status: ${data.status}`);
  
  await browser.close();
})();
