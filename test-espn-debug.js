const puppeteer = require('puppeteer');

async function testESPN() {
  console.log('Testing ESPN selectors...\n');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Test main player page
  console.log('1. Testing main player page...');
  await page.goto('https://www.espn.com.au/nba/player/_/id/3032977/giannis-antetokounmpo', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });
  
  const mainPageData = await page.evaluate(() => {
    // Test headshot
    const headshotImg = document.querySelector('img[data-mptype="image"]');
    
    // Test team - look for link with team info
    const teamLinks = Array.from(document.querySelectorAll('a[data-clubhouse-uid]'));
    const teamInfo = teamLinks.map(link => ({
      text: link.textContent.trim(),
      href: link.href
    }));
    
    // Test status
    const statusEl = document.querySelector('.TextStatus');
    
    // Test bio info
    const bioItems = Array.from(document.querySelectorAll('.PlayerHeader__Bio_List li'));
    
    return {
      headshot: headshotImg?.src || 'NOT FOUND',
      headshotAlt: headshotImg?.alt || 'NOT FOUND',
      teamInfo: teamInfo.length > 0 ? teamInfo : 'NOT FOUND',
      status: statusEl?.textContent?.trim() || 'NOT FOUND',
      bioItemsCount: bioItems.length,
      bioItems: bioItems.map(item => item.textContent.trim())
    };
  });
  
  console.log('Main Page Results:', JSON.stringify(mainPageData, null, 2));
  
  // Test bio page
  console.log('\n2. Testing bio page...');
  await page.goto('https://www.espn.com.au/nba/player/bio/_/id/3032977/giannis-antetokounmpo', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });
  
  const bioPageData = await page.evaluate(() => {
    const highlights = [];
    const history = [];
    
    // Career highlights
    const highlightItems = document.querySelectorAll('.Career__Highlights__Item');
    highlightItems.forEach(item => {
      const content = item.querySelector('.Career__Highlights__Item__Content');
      const title = content?.querySelector('.clr-black')?.textContent?.trim();
      const years = content?.querySelector('.clr-gray-05')?.textContent?.trim();
      if (title) {
        highlights.push(`${title}${years ? ' (' + years + ')' : ''}`);
      }
    });
    
    // Career history
    const historyItems = document.querySelectorAll('.Career__History__Item');
    historyItems.forEach(item => {
      const teamName = item.querySelector('.clr-black')?.textContent?.trim();
      const years = item.querySelector('.clr-gray-05')?.textContent?.trim();
      if (teamName && years) {
        history.push(`${teamName}: ${years}`);
      }
    });
    
    return {
      highlightsCount: highlights.length,
      highlights: highlights,
      historyCount: history.length,
      history: history
    };
  });
  
  console.log('Bio Page Results:', JSON.stringify(bioPageData, null, 2));
  
  await browser.close();
  console.log('\nTest complete!');
}

testESPN().catch(console.error);
