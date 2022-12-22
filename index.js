const express = require('express');
const {LibreLinkUpClient} = require('@diakem/libre-link-up-api-client');
const dayjs = require('dayjs');
const localizedFormat = require('dayjs/plugin/localizedFormat')
dayjs.extend(localizedFormat);
const axios = require('axios');

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
   const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=26.7542&lon=-80.9337&appid=dc2b119fca1bf0d9b093ba28c8d03209`);
   return response.data;
};

async function getLastHighReadingDate(){
   /*
   const {getLogbook} = LibreLinkUpClient({username: 'boenigk@gmail.com', password: 'MdJ!$9Q(aqP6eEF'});
   const response = await getLogbook();
   const logItems = response.filter(item => {
      return item.type == 1
   })
   const highLogItems = logItems.filter(item => {
      return item.Value >= HIGH_GLUCOSE
   })
   return highLogItems[0].date;
   */
   return new Date();
}

app.get('/last-high-reading-date', async (req, res) => {
   const lastHighReadingDate = await getLastHighReadingDate();
   return res.status(200).json({
      lastHighReadingDate: lastHighReadingDate
   });
});

app.get('/', async (req, res) => {
   const weather = await getWeather();

   const lastHighReadingDate = await getLastHighReadingDate();
   const daysSinceLastHigh = dayjs(lastHighReadingDate).diff(dayjs(), 'days');

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
            font-size: 24px;
            font-weight: 500;
         }
         #container{
            margin: 30px;
            display: flex;
            flex: 1;
            flex-direction: column;
         }
         .section{
            display: flex;
            flex: 1;
            flex-direction: column;
         }
         #bloodsugar{
            background-color: black;
            border-radius: 20px;
            color: white;
            align-items: center;
            justify-content: center;
            padding: 20px;
         }
         #number{
            font-size: 86px;
            font-weight: 800;
         }
      </style>
      </head>
      <body>
      <div id="container">
         <div id="weather" class="section">
            <div style="display: flex;">
               <div style="flex: 1;">
                  <div style="font-weight: 800;">${dayjs().format('dddd')}</div>
                  <div>${dayjs().format('MMM D')}</div>
               </div>
               <div style="display: flex; flex: 1; font-size: 48px; text-align: right; align-items: center; justify-content: flex-end">
                  <div>${kelvinToF(weather?.main?.temp)}°</div>
                  <div style="margin-left: 8px;">
                     <img src="/svg/sun.svg" style="width: 48px" />
                  </div>
               </div>
            </div>
         </div>
         <div id="bloodsugar" class="section">
            <div>Current streak</div>
            <div id="number">${daysSinceLastHigh} days</div>      
         </div>
      </div>
      </body></html>
   `;
   res.send(template);
});