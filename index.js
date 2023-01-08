const express = require('express');
const getKindleScreenshot = require('./screenshot');
const render = require('./render');
const { getWeather, getFun, getLastHighReading, getStreaks } = require('./data');
const config = require('./config');

/*
const Pushover = require('node-pushover');
const po = new Pushover({
   token: config.pushoverToken,
   user: config.pushoverUser
});
po.send("Blood sugar streak", "You just hit an all-time high");
*/

const app = express()
const port = 3000;
app.use(express.static(__dirname + '/static'));
app.listen(port, () => {
	console.log(`Listening at http://localhost:${port}`)
})

app.get('/last-high-reading-date', async (req, res) => {
   const lastHighReading = await getLastHighReading();
   return res.status(200).json({lastHighReading: lastHighReading});
});

app.get('/screenshot', async (req, res) => {
   const kindleImagePath = await getKindleScreenshot({
      url: 'http://localhost:3000/',
      width: 1072,
      height: 1448,
      pixelDensity: 2
   });
   res.setHeader('content-type', 'image/png');
   return res.sendFile(kindleImagePath);
});

app.get('/', async (req, res) => {
   const weather = await getWeather();
   const fun = await getFun();
   const lastHighReading = await getLastHighReading();
   const streaks = await getStreaks(lastHighReading);
   const html = render({
      weather,
      fun, 
      streaks
   });
   res.send(html);
});

module.exports = { app };