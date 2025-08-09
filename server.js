const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const xml2js = require('xml2js');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));

let awosCache = {};

function calculateHumidex(tempC, dewPointC) {
  try {
    const e = 6.11 * Math.pow(10, (7.5 * dewPointC) / (237.7 + dewPointC));
    const h = 0.5555 * (e - 10.0);
    return +(tempC + h).toFixed(1);
  } catch {
    return '--';
  }
}

function calculatePressureAltitude(altimeterInHg, elevationFt) {
  try {
    return Math.round((29.92 - altimeterInHg) * 1000 + elevationFt);
  } catch {
    return '--';
  }
}

function calculateDensityAltitude(tempC, pressureAltFt) {
  try {
    const isaTemp = 15 - (pressureAltFt * 0.00198);
    return +(pressureAltFt + 120 * (tempC - isaTemp)).toFixed(2);
  } catch {
    return '--';
  }
}

async function fetchAWOSData() {
  try {
    const session = axios.create({
      auth: {
        username: 'Chris.Pyatt',
        password: 'Weedman4206!'
      }
    });

    const baseUrl = 'https://met.forces.gc.ca/english/airops/Text/';
    const listUrl = `${baseUrl}?mask=XMCN64+CYTR&count=15`;

    const listRes = await session.get(listUrl);
    const $ = cheerio.load(listRes.data);
    const bulletinLinks = $('li a[href^="?item="]');

    if (!bulletinLinks.length) return;

    const latestHref = bulletinLinks.last().attr('href');
    const latestUrl = baseUrl + latestHref;
    const latestRes = await session.get(latestUrl);
    const $$ = cheerio.load(latestRes.data);
    const rawText = $$.text();
    const xmlStart = rawText.indexOf('<?xml');
    const rawXml = xmlStart !== -1 ? rawText.slice(xmlStart) : rawText;

    const parsed = await xml2js.parseStringPromise(rawXml, { explicitArray: false });
    const awos = parsed.awos || {};

    const stationAttrs = awos.station?.['$'] || {};

    const lat = parseFloat(stationAttrs.lat || 0);
    const long = parseFloat(stationAttrs.long || 0);

    const tempC = parseFloat(awos.airtemp?.min2?.['_'] || 0);
    const dewC = parseFloat(awos.dewpt?.min2?.['_'] || 0);
    const altimeterInHg = parseFloat(awos.pressure?.altimeter?.['_'] || 29.92);

    const elevationFt = 283;
    const elevationM = elevationFt * 0.3048;

    const humidex = calculateHumidex(tempC, dewC);
    const pressureAltitude = calculatePressureAltitude(altimeterInHg, elevationFt);
    const densityAltitude = calculateDensityAltitude(tempC, pressureAltitude);

    let rvrRWY24 = '--';
    const rvrList = Array.isArray(awos.rvr) ? awos.rvr : [awos.rvr];
    for (const rvr of rvrList) {
      if (rvr?.['$']?.runway === '24') {
        rvrRWY24 = rvr.min2?.['_'] || '--';
        break;
      }
    }

    const strikes = awos.ltg?.strikes;
    const lightningCount = Array.isArray(strikes) ? strikes.length : 0;

    const gustElem = awos.wind?.speed2minMax || {};
    const gustValue = gustElem['_'] || '--';
    const gustTime = gustElem['$']?.time || '--';

    const windData = {
      '2min': {
        dir: awos.wind?.magDir2min?.['_'] || '--',
        speed: awos.wind?.speed2min?.['_'] || '--',
        gust: gustValue
      },
      '10min': {
        dir: awos.wind?.magDir10min?.['_'] || '--',
        speed: awos.wind?.speed10min?.['_'] || '--',
        gust: gustValue
      },
      '60min': {
        dir: awos.wind?.magDir60min?.['_'] || '--',
        speed: awos.wind?.speed60min?.['_'] || '--',
        gust: gustValue
      },
      variable: awos.wind?.magVRB10min ? 'VRB' : '--',
      gustTime
    };

    //console.log('Raw XML:', rawXml)

    awosCache = {
      serverTime: new Date().toISOString(),
      reportTime: awos.time || '--',
      metar: awos.metar?.['_'] || '--',

      station: {
        id: stationAttrs.id || '--',
        elevation: elevationFt,
        elevationM: elevationM,
        lat: lat,
        long: long
      },

      cloud: awos.sky?.['_'] || '--',
      presentWeather: awos.pwx?.['$']?.position || '--',
      visibility: {
        sm: awos.vis?.[1]?.min2?.['_'] || '--',
        m: awos.vis?.[0]?.min2?.['_'] || '--'
      },
      rvrRWY24,
      temperature: tempC,
      dewPoint: dewC,
      spread: +(tempC - dewC).toFixed(2),
      tempTrend1hr: awos.airtemp?.min60?.['_'] || '--',
      tempTrend3hr: awos.airtemp?.hour24?.['_'] || '--',
      temp12hr: awos.airtemp?.hour12PMmax?.['_'] || '--',
      humidex,
      windChill: '--',
      wind: windData,
      altimeter: altimeterInHg,
      msl: awos.pressure?.qnh?.['_'] || '--',
      stationPressure: awos.pressure?.qfe?.['_'] || '--',
      tendency: {
        '3hr': awos.pressure?.hour24?.['_'] || '--',
        '15min': awos.pressure?.min2?.['_'] || '--',
        '1hr': awos.pressure?.min60?.['_'] || '--'
      },
      pressureAltitude,
      densityAltitude,
      lightning: `${lightningCount} strikes`,
      rawReport: awos.metar?.['_'] || '--',

    };
   // console.log('Parsed AWOS:', parsed.awos);
    //console.log('Station Attributes:', stationAttrs);
    console.log(`AWOS updated at ${awosCache.serverTime}`);
  } catch (err) {
    console.error('Error updating AWOS:', err.message);
  }
}

// Start periodic fetch
setInterval(fetchAWOSData, 60000);
fetchAWOSData();


app.get('/', (req, res) => {
  res.send('AWOS Node Server is Running');
});

app.get('/latest-awos', (req, res) => {
  if (Object.keys(awosCache).length) {
      res.json(awosCache);
  } else {
    res.status(503).json({ error: 'AWOS data not yet loaded' });
  }
});
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

