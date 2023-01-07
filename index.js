const express = require('express');
//const {LibreLinkUpClient} = require('@diakem/libre-link-up-api-client');
const LibreLinkUpClient = require('./libre-link-up-api-client');


const dayjs = require('dayjs');
const localizedFormat = require('dayjs/plugin/localizedFormat');
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(localizedFormat);
const tz = "America/New_York";

const axios = require('axios');
const { Storage } = require('@google-cloud/storage');
const im = require('imagemagick');
const fs = require('fs');
const os = require('os');
const path = require('path');
const tmpdir = os.tmpdir();

const getDashboardScreenshot = require('./screenshot');

const Pushover = require('node-pushover');
const po = new Pushover({
   token: "ahhxoiuf6fj7s8tjaceyvpwhznf76q",
   user: "ub8n2nvtuczj8o3w4bsduprajy815n"
});
//po.send("Blood sugar streak", "You just hit an all-time high");

const HIGH_GLUCOSE = 190;






const app = express()
const port = 3000;
app.use(express.static(__dirname + '/static'));
app.listen(port, () => {
	console.log(`Listening at http://localhost:${port}`)
})

function kelvinToF(kelvin){
   return Math.round(((parseFloat(kelvin)-273.15)*1.8)+32);
}

async function getWeather(){
   let weather;
   try{
      const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=26.7542&lon=-80.9337&appid=dc2b119fca1bf0d9b093ba28c8d03209`);
      weather = response.data;
      //console.log(JSON.stringify(weather));
   }
   catch(error){
      weather = {error: error}
   }
   return weather;
};

let funUpdatedDate = dayjs();
let todaysFun;
async function getFun(){
   let fun;
   try{
      if(todaysFun && funUpdatedDate.isSame(dayjs(), 'day')){
         // same day, let's stick with one fun fact per day
         fun = todaysFun;
      }
      else{
         const response = await axios.get(`https://api.api-ninjas.com/v1/facts?limit=3`, {
            headers: {
               'X-Api-Key': 'EtLa5vWxXF8oIlPWznaj7A==j2p2O5S8PUK0ZDeX'
            }
         });
         for(var i=0; i<response.data.length; i++){
            fun = response.data[i];
            if(fun.fact.length < 140){
               break;
            }
         }
         todaysFun = fun;
      }
      
   }
   catch(error){
      fun = {error: error}
   }
   return fun;
};

async function getLastHighReadingFromLogbook(){
   let lastHighReading;
   try{
      const {getLogbook} = LibreLinkUpClient({username: 'boenigk@gmail.com', password: 'MdJ!$9Q(aqP6eEF'});
      const response = await getLogbook();
      const logItems = response.filter(item => {
         return item.type == 1
      })
      const highLogItems = logItems.filter(item => {
         return item.Value >= HIGH_GLUCOSE
      })
      lastHighReading = (highLogItems[0]) ? highLogItems[0] : null;
   }
   catch(error){
      lastHighReading = { error: error }
   }

   return lastHighReading;
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


async function init(){

   // if not loaded, load longest streak (in seconds timestamp)
   // each new high reading, compare longest streak
   // if it's higher than the current one, save it

   let storedLastHighReadingDate;
   let storedLongestStreak;

   const storage = new Storage();
   const bucket = storage.bucket('527-osceola');
 

   async function getLastHighReading(){

      const STORED_FILENAME = 'storedLastHighReadingDate.json';

      // rehydrate if needed
      if(!storedLastHighReadingDate){
         const storedExists = await bucket.file(STORED_FILENAME).exists();
         if(storedExists[0]){
            const highReadingContents = await bucket.file(STORED_FILENAME).download();
            storedLastHighReadingDate = JSON.parse(highReadingContents);
         }
         else{
            storedLastHighReadingDate = "2022-12-20T14:19:09.000Z"; // fall back to app creation timestamp if we must
         }
         storedLastHighReadingDate = new Date(storedLastHighReadingDate);
      }

      // get from logbook API
      let lastHighReading = await getLastHighReadingFromLogbook();

      // maybe there's no lastHighReading in the logbook
      if(!lastHighReading){
         lastHighReading = {
            date: storedLastHighReadingDate
         }
      }

      // if logbook API date is newer than stored date, store it 
      if(lastHighReading.date.getTime() > storedLastHighReadingDate.getTime()){
         console.log('storage attempt');
         await bucket.file(STORED_FILENAME).save(JSON.stringify(lastHighReading.date));
         storedLastHighReadingDate = lastHighReading.date;
      }

      return lastHighReading;
   }

   async function getLongestStreak(lastHighReading){
      const STORED_FILENAME = 'storedLongestStreak.json';

      if(lastHighReading.error){
         return {
            error: true
         }
      }

      // rehydrate if needed
      if(!storedLongestStreak){
         const storedExists = await bucket.file(STORED_FILENAME).exists();
         if(storedExists[0]){
            const longestStreakContents = await bucket.file(STORED_FILENAME).download();
            storedLongestStreak = JSON.parse(longestStreakContents);
         }
         else{
            storedLongestStreak = 0; // fall back to 0 if we must
         }
      }
      
      let currentStreak = dayjs().diff(dayjs(lastHighReading.date), 'second');

      // if current streak is longer than stored streak, store it 
      if(currentStreak > storedLongestStreak){
         await bucket.file(STORED_FILENAME).save(JSON.stringify(currentStreak));
         storedLongestStreak = currentStreak;
      }

      return {
         currentStreak,
         longestStreak: storedLongestStreak
      }
   }


   app.get('/last-high-reading-date', async (req, res) => {
      const lastHighReading = await getLastHighReading();
      return res.status(200).json({lastHighReading: lastHighReading});
   });

   app.get('/screenshot', async (req, res) => {
      const screenshotImagePath = path.join(tmpdir,'screenshotImage.png');
      const kindleImagePath = path.join(tmpdir,'kindleImage.png');

      const screenshotImage = await getDashboardScreenshot();
      fs.writeFileSync(screenshotImagePath, screenshotImage);
      await imConvert([screenshotImagePath, '-colorspace', 'Gray', '-dither', 'FloydSteinberg', '-quality', '75', '-define', 'png:color-type=0', '-define', 'png:bit-depth=8', kindleImagePath ]);
      res.setHeader('content-type', 'image/png');
      return res.sendFile(kindleImagePath);
   });

   app.get('/', async (req, res) => {
      const weather = await getWeather();
      const fun = await getFun();
      const lastHighReading = await getLastHighReading();
      //console.log(JSON.stringify(lastHighReading, 0, 2));
      const streaks = await getLongestStreak(lastHighReading);
      //console.log(JSON.stringify(streaks, 0, 2));

      const renderWeather = (weather) => {
         const WEATHER_ICONS = {
            '01d': 'sun',
            '01n': 'moon-25',
            '02d': 'cloud-sun',
            '02n': 'cloud-sun2',
            '03d': 'cloud',
            '03n': 'cloud',
            '04d': 'cloud',
            '04n': 'cloud',
            '09d': 'cloud-drizzle-sun',
            '09n': 'cloud-drizzle-moon',
            '10d': 'cloud-rain-2',
            '10n': 'cloud-rain-2-moon',
            '11d': 'cloud-lightning',
            '11n': 'cloud-lightning-moon', 
            '13d': 'cloud-snow',
            '13n': 'cloud-snow-moon',  
            '50d': 'cloud-fog-2',
            '50n': 'cloud-fog-2',
         };

         if(weather.error){
            return '<div>error fetching weather</div>'
         }
         else{
            return`
               <div id="weatherTemp">${kelvinToF(weather.main.temp)}°</div>
               <div style="margin-left: 0px;">
                  <img src="svg/${WEATHER_ICONS[weather.weather[0].icon]}.svg" id="weatherIcon" />
               </div>
            `;
         }
      }

      const getSinceString = (streak) => {
         const daysSince = Math.floor(streak / (3600 * 24));
         const hoursSince = Math.floor(streak / 3600);
         let sinceString;
         if(daysSince < 3){
            sinceString = `${hoursSince} ${(hoursSince == 1) ? 'hour' : 'hours'}`;
         }
         else{
            sinceString = `${daysSince} ${(daysSince == 1) ? 'day' : 'days'}`;
         }
         return sinceString;
      }

      const renderHighReading = (streaks) => {
         if(streaks.error){
            return '<div>error fetching blood sugar</div>'
         }
         else{
            return`
               <div id="number">${getSinceString(streaks.currentStreak)}</div> 
               <div id="longest">Longest: ${getSinceString(streaks.longestStreak)}</div>
            `;
         }
      }

      const renderFun = (fun) => {
         if(fun.error){
            return '<div>error fetching fun stuff</div>'
         }
         return`
            <div><span style="font-weight: 900">Did you know?</span> ${fun.fact}</div>
         `;
      }

      const template = `
         <html>
         <head>
         <meta name="viewport" content="width=device-width, initial-scale=1" />
         <meta name="application-name" content="Streak" />
         <meta name="apple-mobile-web-app-title" content="Streak" />
         <meta name="apple-mobile-web-app-status-bar-style" content="black" />
         <link rel="apple-touch-icon" href="icon.png" />

         <meta http-equiv="refresh" content="3600" />

         <link rel="preconnect" href="https://fonts.googleapis.com"> 
         <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin> 
         <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;800&display=swap" rel="stylesheet">
         <style>
            html, body{
               margin: 0;
               padding: 0;
               font-family: 'Plus Jakarta Sans', sans-serif;
               height: 100%;
               height: -webkit-fill-available;
               width: 100%;
               display: flex;
               font-size: 32px;
               font-weight: 500;
            }
            
            #container{
               display: flex;
               flex: 1;
               flex-direction: column;
            }
            .section{
               margin: 24px;
               display: flex;
               flex: 2;
               flex-direction: column;
            }
            #weather{
               font-size: 1em;
               margin-top: 12px;
               flex: 0;
            }

            #weatherTemp{
               font-size: 1.75em;
            }

            #weatherIcon{
               width: 3em;
            }

            #bloodsugar{
               margin: 0 24px;
               flex: 4;
               background-color: black;
               border-radius: 24px;
               color: white;
               align-items: center;
               justify-content: center;
               padding: 30px;
               text-align: center;
            }
            #number{
               font-size: 2.875em;
               font-weight: 800;
            }
            #joke{
               padding: 0 20px;
               line-height: 1.5em;
               font-size: .875em;
               flex: 3;
               justify-content: center;
               text-align: center;
            }
            #longest{
               margin-top: 20px;
               padding-top: 20px;
               border-top: 1px solid white;
            }

            @media screen and (max-width: 425px) {
               body{
                  font-size: 24px;
               }
               #number{
                  font-size: 2.5em;
               }
               #joke{
                  font-size: .825em;
               }
            }
         </style>
         </head>
         <body>

         <div id="container">
            <div id="weather" class="section">
               <div style="display: flex;">
                  <div style="display: flex; flex-direction: column; flex: 1; justify-content: center;">
                     <div style="font-weight: 800;">${dayjs().tz(tz).format('dddd')}</div>
                     <div>${dayjs().tz(tz).format('MMM D')}</div>
                  </div>
                  <div style="display: flex; flex: 1; text-align: right; align-items: center; justify-content: flex-end">
                     ${renderWeather(weather)}
                  </div>
               </div>
            </div>
            <div id="bloodsugar" class="section">
               <div>Current streak</div>
               ${renderHighReading(streaks)}
            </div>
            <div id="joke" class="section">
               ${renderFun(fun)}
            </div>
         </div>
         </body></html>
      `;
      res.send(template);
   });
}


init();

module.exports = {
   app
};