const puppeteer = require('puppeteer');
const im = require('imagemagick');
const fs = require('fs');
const os = require('os');
const path = require('path');
const tmpdir = os.tmpdir();

async function getScreenshot(options) {
	let browser;
	let page;
   browser = await puppeteer.launch( {
      headless: true,
      args: [
         '--disable-features=AudioServiceOutOfProcess',
         '--disable-features=AudioServiceOutOfProcessKillAtHang',
         '--disable-software-rasterizer',
         '--disable-gpu',
	      '--no-zygote', 
	      '--no-sandbox'
      ],
      defaultViewport: {
         width: options.width/options.pixelDensity,
         height: options.height/options.pixelDensity,
         deviceScaleFactor: options.pixelDensity
     }
   });
   page = await browser.newPage();
	await page.setDefaultNavigationTimeout(0);
   await page.goto(options.url, { waitUntil: 'networkidle0' });
   const image = await page.screenshot();
   await browser.close();
   return image;
}

async function imConvert(args){
   return new Promise((resolve,reject) => {
      im.convert(args, (err, stdout) => {
         if (err) {
            console.log('stdout:', stdout);
            reject();
         }
         else{
            resolve();
         }
      });
   });
}

async function getKindleScreenshot(options){
   const screenshotImagePath = path.join(tmpdir,'screenshotImage.png');
   const kindleImagePath = path.join(tmpdir,'kindleImage.png');
   const screenshotImage = await getScreenshot(options);
   fs.writeFileSync(screenshotImagePath, screenshotImage);
   await imConvert([screenshotImagePath, '-colorspace', 'Gray', '-dither', 'FloydSteinberg', '-quality', '75', '-define', 'png:color-type=0', '-define', 'png:bit-depth=8', kindleImagePath ]);
   return kindleImagePath;
}

module.exports = getKindleScreenshot;