// thanks: @diakem/libre-link-up-api-client

const axios = require('axios');
const LIBRE_LINK_SERVER = 'https://api-us.libreview.io';

const trendMap = [
   'NotComputable',
   'SingleDown',
   'FortyFiveDown',
   'Flat',
   'FortyFiveUp',
   'SingleUp',
   'NotComputable',
 ];
 
 const getTrend = ( trend, defaultTrend = 'Flat') => (
   trend && trendMap[trend] ? trendMap[trend] : defaultTrend
);
 
const toDate = (dateString) => new Date(dateString);
 
const mapData = ({
   Value,
   isHigh,
   isLow,
   TrendArrow,
   FactoryTimestamp,
 }) => ({
   value: Value,
   isHigh,
   isLow,
   trend: getTrend(TrendArrow),
   date: toDate(`${FactoryTimestamp} UTC`),
 });



const urlMap = {
  login: '/llu/auth/login',
  connections: '/llu/connections',
  countries: '/llu/config/country?country=DE',
};

const LibreLinkUpClient = ({
  username,
  password,
  connectionIdentifier,
}) => {
  let jwtToken = null;
  let connectionId = null;

  const instance = axios.create({
    baseURL: LIBRE_LINK_SERVER,
    headers: {
      'accept-encoding': 'gzip',
      'cache-control': 'no-cache',
      connection: 'Keep-Alive',
      'content-type': 'application/json',
      product: 'llu.android',
      version: '4.2.1',
    },
  });
  instance.interceptors.request.use(
    config => {
      if (jwtToken && config.headers) {
        // eslint-disable-next-line no-param-reassign
        config.headers.authorization = `Bearer ${jwtToken}`;
      }

      return config;
    },
    e => e,
    { synchronous: true }
  );

  const login = async () => {
    const loginResponse = await instance.post(urlMap.login, {
      email: username,
      password,
    });

    if (loginResponse.data.data.redirect) {
      const redirectResponse = loginResponse.data;
      const countryNodes = await instance.get(
        urlMap.countries
      );
      const targetRegion = redirectResponse.data.region;
      const regionDefinition = countryNodes.data.data.regionalMap[targetRegion];

      if (!regionDefinition) {
        throw new Error(
          `Unable to find region '${redirectResponse.data.region}'. 
          Available nodes are ${Object.keys(
            countryNodes.data.data.regionalMap
          ).join(', ')}.`
        );
      }

      instance.defaults.baseURL = regionDefinition.lslApi;
      return login();
    }
    jwtToken = (loginResponse.data).data.authTicket.token;

    return loginResponse.data;
  };

  const loginWrapper = (func) =>
    async () => {
      try {
        if (!jwtToken) await login();
        return func();
      } catch (e) {
        await login();
        return func();
      }
    };

  const getConnections = loginWrapper(async () => {
    const response = await instance.get(
      urlMap.connections
    );

    return response.data;
  });

  const getConnection = (connections) => {
    if (typeof connectionIdentifier === 'string') {
      const match = connections.find(
        ({ firstName, lastName }) =>
          `${firstName} ${lastName}`.toLowerCase() ===
          connectionIdentifier.toLowerCase()
      );

      if (!match) {
        throw new Error(
          `Unable to identify connection by given name '${connectionIdentifier}'.`
        );
      }

      return match.patientId;
    }
    if (typeof connectionIdentifier === 'function') {
      const match = connectionIdentifier.call(null, connections);

      if (!match) {
        throw new Error(`Unable to identify connection by given name function`);
      }

      return match;
    }

    return connections[0].patientId;
  };

  const getLogbook = loginWrapper(async () => {
    if (!connectionId) {
      const connections = await getConnections();
      connectionId = getConnection(connections.data);
    }

    const response = await instance.get(
      `${urlMap.connections}/${connectionId}/logbook`
    );

    const rawLogbookResponse = response.data.data;
    const toDate = (dateString) => new Date(dateString);

    return rawLogbookResponse.map((logItem) => ({
      ...logItem,
      date: toDate(`${logItem.FactoryTimestamp} UTC`),
    }));
  });

  const readRaw = loginWrapper(async () => {
    if (!connectionId) {
      const connections = await getConnections();

      connectionId = getConnection(connections.data);
    }

    const response = await instance.get(
      `${urlMap.connections}/${connectionId}/graph`
    );

    return response.data.data;
  });

  const read = async () => {
    const response = await readRaw();

    return {
      current: mapData(response.connection.glucoseMeasurement),
      history: response.graphData.map(mapData),
    };
  };

  const observe = async () => {
    // @todo
  };

  let averageInterval;
  const readAveraged = async (
    amount,
    callback,
    interval = 15000
  ) => {
    let mem = new Map();

    averageInterval = setInterval(async () => {
      const { current, history } = await read();
      mem.set(current.date.toString(), current);

      if (mem.size === amount) {
        const memValues = Array.from(mem.values());
        const averageValue = Math.round(
          memValues.reduce((acc, cur) => acc + cur.value, 0) / amount
        );
        const averageTrend =
          trendMap[
            parseInt(
              (
                Math.round(
                  (memValues.reduce(
                    (acc, cur) => acc + trendMap.indexOf(cur.trend),
                    0
                  ) /
                    amount) *
                    100
                ) / 100
              ).toFixed(0),
              10
            )
          ];

        mem = new Map();
        callback.apply(null, [
          {
            trend: averageTrend,
            value: averageValue,
            date: current.date,
            isHigh: current.isHigh,
            isLow: current.isLow,
          },
          memValues,
          history,
        ]);
      }
    }, interval);

    return () => clearInterval(averageInterval);
  };

  return {
    observe,
    readRaw,
    read,
    readAveraged,
    login,
    getLogbook,
  };
};

module.exports = LibreLinkUpClient;