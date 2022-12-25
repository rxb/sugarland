const puppeteer = require('puppeteer');
const dayjs = require('dayjs');

//const browserExecutablePath = ( process.platform == 'darwin' ) ? '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome' : '/usr/bin/chromium-browser';

async function getDashboardScreenshot(filePath) {
   console.log(`getDashboardScreenshot start ${dayjs().format('HH:mm:ss')}`);

	let browser;
	let page;

   browser = await puppeteer.launch( {
      headless: true,
      //executablePath: browserExecutablePath,
      args: [
         '--disable-features=AudioServiceOutOfProcess',
         '--disable-features=AudioServiceOutOfProcessKillAtHang',
         '--disable-software-rasterizer',
         '--disable-gpu',
         //"--single-process",
	 '--no-zygote', 
	 '--no-sandbox'
      ],
      defaultViewport: {
         width: 1072/2,
         height: 1448/2,
         deviceScaleFactor: 2
     }
   });
   page = await browser.newPage();
	await page.setDefaultNavigationTimeout(0);
   await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
   const image = await page.screenshot(filePath ? { path: filePath } : {});
   await browser.close();
   console.log(`getDashboardScreenshot end ${dayjs().format('HH:mm:ss')}`);
   return image;
}

module.exports = getDashboardScreenshot;