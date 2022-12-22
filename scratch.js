const {LibreLinkUpClient} = require('@diakem/libre-link-up-api-client');
const dayjs = require('dayjs');
const localizedFormat = require('dayjs/plugin/localizedFormat')
dayjs.extend(localizedFormat);

const HIGH_GLUCOSE = 180;

async function init(){
   const {getLogbook} = LibreLinkUpClient({username: 'boenigk@gmail.com', password: 'MdJ!$9Q(aqP6eEF'});

   const response = await getLogbook();
   
   const logItems = response.filter(item => {
      return item.type == 1
   })

   const highLogItems = logItems.filter(item => {
      return item.Value >= HIGH_GLUCOSE
   })
   
   /*
   const highAlarms = response.filter(item => {
      return item.type == 2 && item.alarmType == 1
   })
   console.log(`last log item: ${logItems[0].Value} ${logItems[0].date}`)
   console.log(`log items above ${HIGH_GLUCOSE}: ${highLogItems.length}`);
   console.log(`last log item above ${HIGH_GLUCOSE}: ${highLogItems[0].Value} ${highLogItems[0].date}`)
   console.log(`high alarms: ${highAlarms.length}`);
   console.log(`last alarm: ${highLogItems[0].date}`);
   */
   const lastHighDate = dayjs(highLogItems[0].date);
   const todayDate = dayjs();
   const daysSinceLastHigh = lastHighDate.diff(todayDate, 'days');
   if(daysSinceLastHigh == 0){
      console.log(`last high reading was today`);
   }
   else{
      console.log(`${daysSinceLastHigh} ${(daysSinceLastHigh == 1) ? 'day' : 'days'} since last high reading`);
   }
   console.log(`${highLogItems[0].Value} ${lastHighDate.format('LLL')}`)

}

init();
