const express = require('express');
const {LibreLinkUpClient} = require('@diakem/libre-link-up-api-client');
const dayjs = require('dayjs');
const localizedFormat = require('dayjs/plugin/localizedFormat')
dayjs.extend(localizedFormat);
const axios = require('axios');
const getDashboardScreenshot = require('./screenshot');
const im = require('imagemagick');

const HIGH_GLUCOSE = 180;

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

async function getLastHighReading(){
 
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
      lastHighReading = highLogItems[0];
   }
   catch(error){
      lastHighReading = { error: error }
   }
   return lastHighReading;
   
   /*
   // for testing, to not slam the librelink api
   return {
      date: new Date()
   }
   */
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

   app.get('/last-high-reading-date', async (req, res) => {
      const lastHighReadingDate = await getLastHighReadingDate();
      return res.status(200).json({
         lastHighReadingDate: lastHighReadingDate
      });
   });

   app.get('/screenshot', async (req, res) => {
      await getDashboardScreenshot(__dirname + '/screenshot.png');
      await imConvert(['screenshot.png', '-colorspace', 'Gray', '-dither', 'FloydSteinberg', '-quality', '75', '-define', 'png:color-type=0', '-define', 'png:bit-depth=8', 'kindleImage.png' ]);
      res.setHeader('content-type', 'image/png');
      return res.sendFile(__dirname + '/kindleImage.png');
   });

   app.get('/', async (req, res) => {
      const weather = await getWeather();
      const fun = await getFun();
      const lastHighReading = await getLastHighReading();

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
               <div>${kelvinToF(weather.main.temp)}°</div>
               <div style="margin-left: 0px;">
                  <img src="/svg/${WEATHER_ICONS[weather.weather[0].icon]}.svg" style="width: 92px" />
               </div>
            `;
         }
      }

      const renderHighReading = (lastHighReading) => {
         if(lastHighReading.error){
            return '<div>error fetching blood sugar</div>'
         }
         else{
            const daysSinceLastHigh = dayjs(lastHighReading.date).diff(dayjs(), 'days');
            return`
               <div id="number">${daysSinceLastHigh} days</div> 
            `;
         }
      }

      const renderFun = (fun) => {
         if(fun.error){
            return '<div>error fetching fun stuff</div>'
         }
         return`
            <div><span style="font-weight: 900">Fun fact:</span> ${fun.fact}</div>
         `;
      }

      const template = `
         <html>
         <head>
         <link rel="preconnect" href="https://fonts.googleapis.com"> 
         <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin> 
         <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;800&display=swap" rel="stylesheet">
         <style>
            html, body{
               margin: 0;
               padding: 0;
               font-family: 'Plus Jakarta Sans', sans-serif;
               height: 100%;
               width: 100%;
               display: flex;
               font-size: 30px;
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
               font-size: 30px;
               margin-top: 12px;
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
            }
            #number{
               font-size: 92px;
               font-weight: 800;
            }
            #joke{
               padding: 0 20px;
               line-height: 1.5em;
               font-size: 24px;
               flex: 3;
               justify-content: center;
               text-align: center;
            }
         </style>
         </head>
         <body>
         <div id="container">
            <div id="weather" class="section">
               <div style="display: flex;">
                  <div style="display: flex; flex-direction: column; flex: 1; justify-content: center;">
                     <div style="font-weight: 800;">${dayjs().format('dddd')}</div>
                     <div>${dayjs().format('MMM D')}</div>
                  </div>
                  <div style="display: flex; flex: 1; font-size: 56px; text-align: right; align-items: center; justify-content: flex-end">
                     ${renderWeather(weather)}
                  </div>
               </div>
            </div>
            <div id="bloodsugar" class="section">
               <div>Current streak</div>
               ${renderHighReading(lastHighReading)}
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