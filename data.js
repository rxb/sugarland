const config = require('./config');
const LibreLinkUpClient = require('./libre-link-up-api-client');
const dayjs = require('dayjs');
const axios = require('axios');
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const bucket = storage.bucket('527-osceola');

async function getWeather(){
   let weather;
   try{
      const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=26.7542&lon=-80.9337&appid=${config.openweathermapKey}`);
      weather = response.data;
   }
   catch(error){
      weather = {error: error}
   }
   return weather;
};

let funUpdatedDate = dayjs();
let todaysFun;
let storedLastHighReadingDate;
let storedLongestStreak;

async function getFun(){
   let fun;
   try{
      if(todaysFun && funUpdatedDate.isSame(dayjs(), 'day')){
         // same day, let's stick with one fun fact per day
         fun = todaysFun;
      }
      else{
         const response = await axios.get(`https://api.api-ninjas.com/v1/facts?limit=3`, {
            headers: { 'X-Api-Key': config.apiNinjasKey }
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
      const {getLogbook} = LibreLinkUpClient({username: config.libreUsername, password: config.librePassword});
      const response = await getLogbook();
      const logItems = response.filter(item => {
         return item.type == 1
      })
      const highLogItems = logItems.filter(item => {
         return item.Value >= config.highGlucose
      })
      lastHighReading = (highLogItems[0]) ? highLogItems[0] : null;
   }
   catch(error){
      lastHighReading = { error: error }
   }

   return lastHighReading;
}

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

async function getStreaks(lastHighReading){

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

module.exports = {
   getWeather,
   getFun,
   getLastHighReading,
   getStreaks,
}