const puppeteer = require('puppeteer');

(async () => {
  console.log('Testing formatted career data for Kevin Durant...\n');
  
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://www.espn.com.au/nba/player/bio/_/id/3202/kevin-durant', {
    waitUntil: 'networkidle2'
  });
  
  // Extract and format career highlights
  const careerHighlights = await page.evaluate(() => {
    const highlights = [];
    
    const highlightItems = Array.from(document.querySelectorAll('.Career__Highlights__Item'));
    highlightItems.forEach(item => {
      const content = item.querySelector('.Career__Highlights__Item__Content');
      const title = content?.querySelector('.clr-black')?.textContent?.trim();
      const years = content?.querySelector('.clr-gray-05')?.textContent?.trim();
      if (title && years) {
        highlights.push({ title, years });
      }
    });

    return highlights;
  });
  
  console.log('Raw Career Highlights:');
  console.log(JSON.stringify(careerHighlights.slice(0, 3), null, 2));
  
  // Format highlights
  const formattedHighlights = [];
  careerHighlights.forEach(highlight => {
    const yearMatches = highlight.years.match(/\d{4}/g);
    if (yearMatches) {
      yearMatches.forEach(year => {
        formattedHighlights.push(`${year} | ${highlight.title}`);
      });
    }
  });
  
  console.log('\nFormatted Career Highlights (first 10):');
  console.log(formattedHighlights.slice(0, 10).join('\n'));
  
  // Extract and format career history
  const careerHistory = await page.evaluate(() => {
    const history = [];
    
    const historyItems = Array.from(document.querySelectorAll('.Career__History__Item'));
    historyItems.forEach(item => {
      const teamName = item.querySelector('.clr-black')?.textContent?.trim();
      const years = item.querySelector('.clr-gray-05')?.textContent?.trim();
      if (teamName && years) {
        history.push({ team: teamName, years });
      }
    });

    return history;
  });
  
  console.log('\n\nRaw Career History:');
  console.log(JSON.stringify(careerHistory, null, 2));
  
  // Format history
  const formattedHistory = [];
  careerHistory.forEach(item => {
    const yearsMatch = item.years.match(/(\d{4})(?:-(\d{4}|CURRENT))?/);
    if (yearsMatch) {
      const startYear = parseInt(yearsMatch[1]);
      formattedHistory.push(`${startYear} | ${item.team}`);
    }
  });
  
  console.log('\nFormatted Career History:');
  console.log(formattedHistory.join('\n'));
  
  await browser.close();
  console.log('\nTest complete!');
})();
