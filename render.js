const dayjs = require('dayjs');
const localizedFormat = require('dayjs/plugin/localizedFormat');
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(localizedFormat);
const tz = "America/New_York";

const kelvinToF = (kelvin) => {
   return Math.round(((parseFloat(kelvin)-273.15)*1.8)+32);
}

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

const render = (props) => {

   const { 
      fun, 
      streaks, 
      weather 
   } = props;

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

   return template;
}

module.exports = render;