const express = require('express');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const xml2js = require('xml2js');
const UA = 'AWOS-Server/1.0 (+http://localhost:3000) (Node.js)';
const app = express();
const PORT = 3000;
const TAF_TTL_MS = 5 * 60 * 1000;
const AWC_BASE =
    'https://aviationweather.gov/adds/dataserver_current/httpparam';

let tafCache = { station: 'CYTR', data: null, fetchedAt: 0 };
let awosCache = {};

app.use(express.static(path.join(__dirname, 'public')));

const fetchJSON = async (url) => {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
};
const fetchText = async (url) => {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
};
const parseTgftp = (body) => {
    const lines = body.trim().split(/\r?\n/).filter(Boolean);
    const issued = lines.shift();
    const raw = lines.join(' ').replace(/\b(FM\d{6}|BECMG|TEMPO|PROB30|PROB40|RMK)\b/g, '\n$1');
    return { raw: raw.trim(), issued };
};
async function getWx(station) {
  const s = station.toUpperCase();
  try {
    const url = `https://aviationweather.gov/api/data/metar?ids=${s}&hours=0&order=id%2C-obs&sep=true&taf=true`;
    const rawText = await fetchText(url);

    const [metarRaw, tafRaw] = rawText.split(new RegExp(`\\bTAF\\s+${s}\\b`, 'i'));
    const metarIssued = metarRaw.match(/\b\d{6}Z\b/)?.[0] || '--';
    const tafIssued = tafRaw?.match(/\b\d{6}Z\b/)?.[0] || '--';

    return {
      metar: { raw: metarRaw.trim(), issued: metarIssued },
      taf: tafRaw
        ? { raw: `TAF ${s} ${tafRaw.trim()}`, issued: tafIssued }
        : { raw: 'TAF not available', issued: '--', _source: 'AWC (error)' }
    };
  } catch (err) {
    console.error('Unified METAR/TAF fetch failed:', err.message);
    return {
      metar: { raw: '--', issued: '--' },
      taf: { raw: 'TAF not available', issued: '--', _source: 'AWC (error)' }
    };
  }
}
async function upsertAwcMetarTaf(cache) {
  try {
    const wx = await getWx('CYTR'); // returns { metar, taf }
    cache.official ??= {};
    cache.official.metar = wx.metar;
    cache.official.taf = wx.taf;
  } catch (err) {
    console.error('AWOS patch error:', err.message);
  }
}
async function fetchLatestTaf(station = 'CYTR') {
    const url = `${AWC_BASE}?datasource=tafs&requestType=retrieve&format=JSON&mostRecent=true&hoursBeforeNow=24&stationString=${encodeURIComponent(station)}`;

    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`AWC TAF fetch failed: ${res.status}`);
    const json = await res.json();

    const taf = json?.data?.TAF?.[0];
    if (!taf?.raw_text) throw new Error('No TAF in AWC response');

    return {
        raw: formatTaf(taf.raw_text),
        issued: toZulu(taf.issue_time || taf.bulletin_time || taf.recv_time),
        validFrom: toZulu(taf.valid_time_from),
        validTo: toZulu(taf.valid_time_to),
        _source: 'AWC',
    };
}
async function getCachedTaf(station = 'CYTR') {
    const now = Date.now();
    const fresh = tafCache.data && (now - tafCache.fetchedAt) < TAF_TTL_MS && tafCache.station === station;
    if (fresh) return tafCache.data;

    try {
        const taf = await fetchLatestTaf(station);
        tafCache = { station, data: taf, fetchedAt: now };
        return taf;
    } catch (err) {
        console.error('TAF refresh failed:', err.message);
        // Fall back to last known TAF if available
        if (tafCache.data) return tafCache.data;
        return { raw: 'TAF not available', issued: undefined, _source: 'AWC (error)' };
    }
}
async function warmTaf() { tafCache.data = await fetchLatestTaf(tafCache.station); tafCache.fetchedAt = Date.now(); }
function formatTaf(raw) {
    // Add line breaks for readability in your modal
    return raw
        .replace(/\s+/g, ' ') // normalize spacing
        .replace(/\b(BECMG|TEMPO|PROB\d{2}|FM\d{6})\b/g, '\n$1')
        .replace(/\s+RMK\s+/g, '\nRMK ');
}
function toZulu(s) {
    if (!s) return undefined;
    const d = new Date(s);
    if (isNaN(d)) return s;
    // Example: 2025-08-10 05:00Z
    return d.toISOString().replace('T', ' ').slice(0, 16) + 'Z';
}
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
        return Math.round(pressureAltFt + 120 * (tempC - (15 - (pressureAltFt * 0.00198))));
    } catch {
        return '--';
    }
}
function parseWindVariabilityFromMetar(metar) {
    try {
        const m = metar && metar.match(/\b(\d{3})V(\d{3})\b/);
        if (m) return `${m[1]}° to ${m[2]}°`;
    } catch {}
    return '--';
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

        // Station
        const elevationFt = 283;
        const elevationM = +(elevationFt * 0.3048).toFixed(1);
        const lat = parseFloat(stationAttrs.lat || 0);
        const long = parseFloat(stationAttrs.long || 0);

        // Temps
        const tempC = parseFloat(awos.airtemp?.min2?.['_'] || 0);
        const dewC = parseFloat(awos.dewpt?.min2?.['_'] || 0);
        const humidex = calculateHumidex(tempC, dewC);
        const relativeHumidity = parseFloat(awos.rh?.min2?.['_'] || '--');

        // Pressure
        const altimeterInHg = parseFloat(awos.pressure?.altimeter?.['_'] || 29.92);
        const mslRaw = parseFloat(awos.pressure?.qnh?.['_'] || 0);
        const mslTruncated = Math.floor(mslRaw * 10) / 10;
        const stationPressure = parseFloat(awos.pressure?.qfe?.['_'] || 0);
        const pressureAltitude = calculatePressureAltitude(altimeterInHg, elevationFt);
        const densityAltitude = calculateDensityAltitude(tempC, pressureAltitude);


        // Visibility & RVR
        const visArray = Array.isArray(awos.vis) ? awos.vis : (awos.vis ? [awos.vis] : []);
        const visM = visArray?.[0]?.min2?.['_'] || '--';
        const visSM = visArray?.[1]?.min2?.['_'] || '--';
        const visValues = visArray.map(v => parseFloat(v?.min2?.['_'] || NaN)).filter(v => !Number.isNaN(v));
        const visibilityMin = visValues.length ? Math.min(...visValues) : '--';
        const visibilityMax = visValues.length ? Math.max(...visValues) : '--';

        let rvrRWY24 = '--';
        const rvrList = Array.isArray(awos.rvr) ? awos.rvr : [awos.rvr];
        for (const rvr of rvrList) {
            if (rvr?.['$']?.runway === '24') {
                rvrRWY24 = rvr.min2?.['_'] || '--';
                break;
            }
        }

        // Wind
        const gustElem = awos.wind?.speed2minMax || {};
        const gustValue = gustElem['_'] || '--';
        const gustTime = gustElem['$']?.time || '--';

        const windData = {
            true: { // optional, only if present in XML
                '2min': awos.wind?.trueDir2min?.['_'] || '--',
                '10min': awos.wind?.trueDir10min?.['_'] || '--',
                '60min': awos.wind?.trueDir60min?.['_'] || '--'
            },
            mag: {
                '2min': awos.wind?.magDir2min?.['_'] || '--',
                '10min': awos.wind?.magDir10min?.['_'] || '--',
                '60min': awos.wind?.magDir60min?.['_'] || '--'
            },
            speed: {
                '2min': awos.wind?.speed2min?.['_'] || '--',
                '10min': awos.wind?.speed10min?.['_'] || '--',
                '60min': awos.wind?.speed60min?.['_'] || '--'
            },
            gust: gustValue,
            variable: awos.wind?.magVRB10min ? 'VRB' : '--',
            gustTime
        };

        // Lightning
        const strikes = awos.ltg?.strikes;
        const lightningCount = Array.isArray(strikes) ? strikes.length : 0;

        // Raw METAR and variability
        const rawMetar = awos.metar?.['_'] || '--';
        const windVarRange = parseWindVariabilityFromMetar(rawMetar);

        awosCache = {
            serverTime: new Date().toISOString(),
            reportTime: awos.time || '--',

            station: {
                id: stationAttrs.id || '--',
                elevation: elevationFt,
                elevationM,
                lat,
                long
            },

            // Sections
            rawReport: rawMetar,
            cloud: awos.sky?.['_'] || '--',
            presentWeather: awos.pwx?.['$']?.position || '--',

            temperature: tempC,
            dewPoint: dewC,
            relativeHumidity,
            spread: +(tempC - dewC).toFixed(2),
            humidex,
            windChill: '--',

            visibility: { sm: visSM, m: visM, min: visibilityMin, max: visibilityMax },
            rvrRWY24,

            wind: {
                '2min': { true: windData.true['2min'], mag: windData.mag['2min'], speed: windData.speed['2min'], gust: windData.gust },
                '10min': { true: windData.true['10min'], mag: windData.mag['10min'], speed: windData.speed['10min'], gust: windData.gust },
                '60min': { true: windData.true['60min'], mag: windData.mag['60min'], speed: windData.speed['60min'], gust: windData.gust },
                variable: windData.variable,
                gustTime: windData.gustTime,
                variabilityRange: windVarRange
            },

            altimeter: altimeterInHg,
            mslRaw,
            mslTruncated,
            stationPressure: +stationPressure.toFixed(1),

            tendency: {
                '3hr': awos.pressure?.hour24?.['_'] || '--',
                '15min': awos.pressure?.min2?.['_'] || '--',
                '1hr': awos.pressure?.min60?.['_'] || '--'
            },

            pressureAltitude,
            densityAltitude,

            lightning: `${lightningCount} strikes`,
            closestStrike: '--' // placeholder; no source available
        };

        awosCache.rawXml = rawXml;
        console.log(`AWOS updated at ${awosCache.serverTime}`);
    } catch (err) {
        console.error('Error updating AWOS:', err.message);
    }
}

setInterval(fetchAWOSData, 60000);
setInterval(() => warmTaf().catch(()=>{}), 10 * 60 * 1000);

fetchAWOSData();
warmTaf().catch(()=>{});

app.get('/latest-awos', async (req, res) => {
  try {
    if (!Object.keys(awosCache).length) {
      return res.status(503).json({ error: 'AWOS data not yet loaded' });
    }

    // Patch in official METAR and TAF
    await upsertAwcMetarTaf(awosCache);

    // Reorder keys into new object
    const reorderedBase = {
      serverTime: awosCache.serverTime,
      reportTime: awosCache.reportTime,
      station: awosCache.station,
      rawReport: awosCache.rawReport,
      official: awosCache.official,
      cloud: awosCache.cloud,
      presentWeather: awosCache.presentWeather,
      temperature: awosCache.temperature,
      dewPoint: awosCache.dewPoint,
      relativeHumidity: awosCache.relativeHumidity,
      spread: awosCache.spread,
      humidex: awosCache.humidex,
      windChill: awosCache.windChill,
      visibility: awosCache.visibility,
      rvrRWY24: awosCache.rvrRWY24,
      wind: awosCache.wind,
      altimeter: awosCache.altimeter,
      mslRaw: awosCache.mslRaw,
      stationPressure: awosCache.stationPressure,
      tendency: awosCache.tendency,
      pressureAltitude: awosCache.pressureAltitude,
      densityAltitude: awosCache.densityAltitude,
      lightning: awosCache.lightning,
      closestStrike: awosCache.closestStrike,
      rawXml: awosCache.rawXml
    };

    res.set('Cache-Control', 'no-store');
    res.json(reorderedBase); // ✅ Only call once

  } catch (e) {
    console.error('latest-awos error:', e);
    res.status(502).json({ error: 'AWOS + METAR/TAF fetch failed' });
  }
});
app.get('/raw-xml', (req, res) => {
    if (awosCache.rawXml) {
        res.set('Content-Type', 'application/xml');
        res.send(awosCache.rawXml);
    } else {
        res.status(503).send('Raw XML not yet available');
    }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));