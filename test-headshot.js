const puppeteer = require('puppeteer');

(async () => {
  console.log('Testing headshot selectors...\n');
  
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://www.espn.com.au/nba/player/_/id/3032977/giannis-antetokounmpo', {
    waitUntil: 'networkidle2'
  });
  
  // Check all images in PlayerHeader area
  const playerHeaderImages = await page.evaluate(() => {
    const playerHeader = document.querySelector('.PlayerHeader');
    if (!playerHeader) return null;
    
    const allImgs = Array.from(playerHeader.querySelectorAll('img'));
    return allImgs.map((img, index) => ({
      index,
      src: img.src,
      alt: img.alt,
      className: img.className,
      hasHeadshotInUrl: img.src.includes('headshot')
    }));
  });
  
  console.log('All images in .PlayerHeader:');
  console.log(JSON.stringify(playerHeaderImages, null, 2));
  
  // Try finding the actual headshot
  const headshotImage = await page.evaluate(() => {
    // Look for headshot in src
    const imgs = Array.from(document.querySelectorAll('img'));
    const headshot = imgs.find(img => img.src.includes('/i/headshots/'));
    
    return headshot ? {
      src: headshot.src,
      alt: headshot.alt,
      className: headshot.className
    } : null;
  });
  
  console.log('\nImage with /i/headshots/ in src:');
  console.log(JSON.stringify(headshotImage, null, 2));
  
  await browser.close();
  console.log('\nTest complete!');
})();
