// const express = require('express');
// const axios = require('axios');
// const cheerio = require('cheerio');
// const xml2js = require('xml2js');
// const path = require('path');
// const UA = 'AWOS-Server/1.0 (+http://localhost:3000) (Node.js)';
// const app = express();
// const PORT = 3000;
//
// app.use(express.static(path.join(__dirname, 'public')));
//
// let awosCache = {};
//
// const fetchJSON = async (url) => {
//     const res = await fetch(url, { headers: { 'User-Agent': UA } });
//     if (!res.ok) throw new Error(`HTTP ${res.status}`);
//     return res.json();
// };
//
// const fetchText = async (url) => {
//     const res = await fetch(url, { headers: { 'User-Agent': UA } });
//     if (!res.ok) throw new Error(`HTTP ${res.status}`);
//     return res.text();
// };
//
// const parseTgftp = (body) => {
//     const lines = body.trim().split(/\r?\n/).filter(Boolean);
//     const issued = lines.shift(); // First line is typically the issuance time
//
//     // Combine rest into one string and add line breaks before key labels
//     const raw = lines.join(' ')
//         .replace(/\b(FM\d{6}|BECMG|TEMPO|PROB30|PROB40|RMK)\b/g, '\n$1');
//
//     return { raw: raw.trim(), issued };
// };
//
// async function getWx(station, type) {
//     const s = station.toUpperCase();
//     const source = type === 'metar' ? 'metars' : 'tafs';
//
//     try {
//         const jsonUrl = `https://aviationweather.gov/adds/dataserver_current/httpparam?dataSource=${source}&requestType=retrieve&format=JSON&stations=${s}&hoursBeforeNow=6`;
//         const data = await fetchJSON(jsonUrl);
//         const entries = data?.data?.[source.toUpperCase()];
//         if (entries?.length) {
//             const sorted = [...entries].sort((a, b) => new Date(b.issue_time || b.observation_time) - new Date(a.issue_time || a.observation_time));
//             const latest = sorted[0];
//             if (latest?.raw_text) return { raw: latest.raw_text, issued: latest.issue_time || latest.observation_time };
//         }
//
//     } catch {}
//
//     try {
//         const txtUrl = `https://tgftp.nws.noaa.gov/data/${type === 'metar' ? 'observations/metar' : 'forecasts/taf'}/stations/${s}.TXT`;
//         const txt = await fetchText(txtUrl);
//         return parseTgftp(txt);
//     } catch {}
//
//     throw new Error(`No ${type.toUpperCase()} for ${s}`);
// }
//
// function calculateHumidex(tempC, dewPointC) {
//     try {
//         const e = 6.11 * Math.pow(10, (7.5 * dewPointC) / (237.7 + dewPointC));
//         const h = 0.5555 * (e - 10.0);
//         return +(tempC + h).toFixed(1);
//     } catch {
//         return '--';
//     }
// }
//
// function calculatePressureAltitude(altimeterInHg, elevationFt) {
//     try {
//         return Math.round((29.92 - altimeterInHg) * 1000 + elevationFt);
//     } catch {
//         return '--';
//     }
// }
//
// function calculateDensityAltitude(tempC, pressureAltFt) {
//     try {
//         return Math.round(pressureAltFt + 120 * (tempC - (15 - (pressureAltFt * 0.00198))));
//     } catch {
//         return '--';
//     }
// }
//
// function parseWindVariabilityFromMetar(metar) {
//     try {
//         const m = metar && metar.match(/\b(\d{3})V(\d{3})\b/);
//         if (m) return `${m[1]}° to ${m[2]}°`;
//     } catch {}
//     return '--';
// }
//
// async function fetchAWOSData() {
//     try {
//         const session = axios.create({
//             auth: {
//                 username: 'Chris.Pyatt',
//                 password: 'Weedman4206!'
//             }
//         });
//
//         const baseUrl = 'https://met.forces.gc.ca/english/airops/Text/';
//         const listUrl = `${baseUrl}?mask=XMCN64+CYTR&count=15`;
//
//         const listRes = await session.get(listUrl);
//         const $ = cheerio.load(listRes.data);
//         const bulletinLinks = $('li a[href^="?item="]');
//         if (!bulletinLinks.length) return;
//
//         const latestHref = bulletinLinks.last().attr('href');
//         const latestUrl = baseUrl + latestHref;
//         const latestRes = await session.get(latestUrl);
//         const $$ = cheerio.load(latestRes.data);
//         const rawText = $$.text();
//         const xmlStart = rawText.indexOf('<?xml');
//         const rawXml = xmlStart !== -1 ? rawText.slice(xmlStart) : rawText;
//
//         const parsed = await xml2js.parseStringPromise(rawXml, { explicitArray: false });
//         const awos = parsed.awos || {};
//         const stationAttrs = awos.station?.['$'] || {};
//
//         // Station
//         const elevationFt = 283;
//         const elevationM = +(elevationFt * 0.3048).toFixed(1);
//         const lat = parseFloat(stationAttrs.lat || 0);
//         const long = parseFloat(stationAttrs.long || 0);
//
//         // Temps
//         const tempC = parseFloat(awos.airtemp?.min2?.['_'] || 0);
//         const dewC = parseFloat(awos.dewpt?.min2?.['_'] || 0);
//         const humidex = calculateHumidex(tempC, dewC);
//         const relativeHumidity = parseFloat(awos.rh?.min2?.['_'] || '--');
//
//         // Pressure
//         const altimeterInHg = parseFloat(awos.pressure?.altimeter?.['_'] || 29.92);
//         const mslRaw = parseFloat(awos.pressure?.qnh?.['_'] || 0);
//         const mslTruncated = Math.floor(mslRaw * 10) / 10;
//         const stationPressure = parseFloat(awos.pressure?.qfe?.['_'] || 0);
//         const pressureAltitude = calculatePressureAltitude(altimeterInHg, elevationFt);
//         const densityAltitude = calculateDensityAltitude(tempC, pressureAltitude);
//
//
//         // Visibility & RVR
//         const visArray = Array.isArray(awos.vis) ? awos.vis : (awos.vis ? [awos.vis] : []);
//         const visM = visArray?.[0]?.min2?.['_'] || '--';
//         const visSM = visArray?.[1]?.min2?.['_'] || '--';
//         const visValues = visArray.map(v => parseFloat(v?.min2?.['_'] || NaN)).filter(v => !Number.isNaN(v));
//         const visibilityMin = visValues.length ? Math.min(...visValues) : '--';
//         const visibilityMax = visValues.length ? Math.max(...visValues) : '--';
//
//         let rvrRWY24 = '--';
//         const rvrList = Array.isArray(awos.rvr) ? awos.rvr : [awos.rvr];
//         for (const rvr of rvrList) {
//             if (rvr?.['$']?.runway === '24') {
//                 rvrRWY24 = rvr.min2?.['_'] || '--';
//                 break;
//             }
//         }
//
//         // Wind
//         const gustElem = awos.wind?.speed2minMax || {};
//         const gustValue = gustElem['_'] || '--';
//         const gustTime = gustElem['$']?.time || '--';
//
//         const windData = {
//             true: { // optional, only if present in XML
//                 '2min': awos.wind?.trueDir2min?.['_'] || '--',
//                 '10min': awos.wind?.trueDir10min?.['_'] || '--',
//                 '60min': awos.wind?.trueDir60min?.['_'] || '--'
//             },
//             mag: {
//                 '2min': awos.wind?.magDir2min?.['_'] || '--',
//                 '10min': awos.wind?.magDir10min?.['_'] || '--',
//                 '60min': awos.wind?.magDir60min?.['_'] || '--'
//             },
//             speed: {
//                 '2min': awos.wind?.speed2min?.['_'] || '--',
//                 '10min': awos.wind?.speed10min?.['_'] || '--',
//                 '60min': awos.wind?.speed60min?.['_'] || '--'
//             },
//             gust: gustValue,
//             variable: awos.wind?.magVRB10min ? 'VRB' : '--',
//             gustTime
//         };
//
//         // Lightning
//         const strikes = awos.ltg?.strikes;
//         const lightningCount = Array.isArray(strikes) ? strikes.length : 0;
//
//         // Raw METAR and variability
//         const rawMetar = awos.metar?.['_'] || '--';
//         const windVarRange = parseWindVariabilityFromMetar(rawMetar);
//
//         awosCache = {
//             serverTime: new Date().toISOString(),
//             reportTime: awos.time || '--',
//
//             station: {
//                 id: stationAttrs.id || '--',
//                 elevation: elevationFt,
//                 elevationM,
//                 lat,
//                 long
//             },
//
//             // Sections
//             rawReport: rawMetar,
//             cloud: awos.sky?.['_'] || '--',
//             presentWeather: awos.pwx?.['$']?.position || '--',
//
//             temperature: tempC,
//             dewPoint: dewC,
//             relativeHumidity,
//             spread: +(tempC - dewC).toFixed(2),
//             humidex,
//             windChill: '--',
//
//             visibility: { sm: visSM, m: visM, min: visibilityMin, max: visibilityMax },
//             rvrRWY24,
//
//             wind: {
//                 '2min': { true: windData.true['2min'], mag: windData.mag['2min'], speed: windData.speed['2min'], gust: windData.gust },
//                 '10min': { true: windData.true['10min'], mag: windData.mag['10min'], speed: windData.speed['10min'], gust: windData.gust },
//                 '60min': { true: windData.true['60min'], mag: windData.mag['60min'], speed: windData.speed['60min'], gust: windData.gust },
//                 variable: windData.variable,
//                 gustTime: windData.gustTime,
//                 variabilityRange: windVarRange
//             },
//
//             altimeter: altimeterInHg,
//             mslRaw,
//             mslTruncated,
//             stationPressure: +stationPressure.toFixed(1),
//
//             tendency: {
//                 '3hr': awos.pressure?.hour24?.['_'] || '--',
//                 '15min': awos.pressure?.min2?.['_'] || '--',
//                 '1hr': awos.pressure?.min60?.['_'] || '--'
//             },
//
//             pressureAltitude,
//             densityAltitude,
//
//             lightning: `${lightningCount} strikes`,
//             closestStrike: '--' // placeholder; no source available
//         };
//
//         awosCache.rawXml = rawXml;
//         console.log(`AWOS updated at ${awosCache.serverTime}`);
//     } catch (err) {
//         console.error('Error updating AWOS:', err.message);
//     }
// }
//
// // periodic fetch
// setInterval(fetchAWOSData, 60000);
// fetchAWOSData();
//
// // 🟨 Routes
// app.get('/', (req, res) => {
//     res.send('AWOS Node Server is Running');
// });
//
// app.get('/latest-awos', (req, res) => {
//     if (Object.keys(awosCache).length) {
//         res.json(awosCache);
//     } else {
//         res.status(503).json({ error: 'AWOS data not yet loaded' });
//     }
// });
// app.get('/raw-xml', (req, res) => {
//     if (awosCache.rawXml) {
//         res.set('Content-Type', 'application/xml');
//        res.send(awosCache.rawXml);
//    } else {
//        res.status(503).send('Raw XML not yet available');
//    }
//});
//
//
// // Official METAR (Actual METAR)
// app.get('/official-metar', async (req, res) => {
//     try {
//         const { raw } = await getWx('CYTR', 'metar');
//         res.send(raw);
//     } catch (e) {
//         res.status(404).send('Error fetching METAR');
//     }
// });
//
// // Latest TAF
// app.get('/latest-taf', async (req, res) => {
//     try {
//         const { raw } = await getWx('CYTR', 'taf');
//         res.send(raw);
//     } catch (e) {
//         res.status(404).send('Error fetching TAF');
//     }
// });
//
// app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
//
const express = require('express');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const xml2js = require('xml2js');
const UA = 'AWOS-Server/1.0 (+http://localhost:3000) (Node.js)';
const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));

let awosCache = {};

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

async function getWx(station, type) {
    const s = station.toUpperCase();
    const source = type === 'metar' ? 'metars' : 'tafs';
    try {
        const jsonUrl = `https://aviationweather.gov/adds/dataserver_current/httpparam?dataSource=${source}&requestType=retrieve&format=JSON&stations=${s}&hoursBeforeNow=6`;
        const data = await fetchJSON(jsonUrl);
        const entries = data?.data?.[source.toUpperCase()];
        if (entries?.length) {
            const latest = [...entries].sort((a, b) =>
                new Date(b.issue_time || b.observation_time) - new Date(a.issue_time || a.observation_time)
            )[0];
            if (latest?.raw_text) return { raw: latest.raw_text, issued: latest.issue_time || latest.observation_time };
        }
    } catch {}

    try {
        const txtUrl = `https://tgftp.nws.noaa.gov/data/${type === 'metar' ? 'observations/metar' : 'forecasts/taf'}/stations/${s}.TXT`;
        const txt = await fetchText(txtUrl);
        return parseTgftp(txt);
    } catch {}

    return { raw: '--', issued: '--' };
}

// 👇 NEW helper to patch awosCache with official METAR + TAF
async function upsertAwcMetarTaf(cache) {
    try {
        const metar = await getWx('CYTR', 'metar');
        const taf = await getWx('CYTR', 'taf');
        cache.official = { metar, taf };
    } catch (err) {
        console.error('upsertAwcMetarTaf error:', err.message);
    }
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
fetchAWOSData();

app.get('/latest-awos', async (req, res) => {
    try {
        if (!Object.keys(awosCache).length) {
            return res.status(503).json({ error: 'AWOS data not yet loaded' });
        }

        await upsertAwcMetarTaf(awosCache); // ✅ Patch in the official data

        res.set('Cache-Control', 'no-store');

        const reordered = {
            serverTime: awosCache.serverTime,
            reportTime: awosCache.reportTime,
            station: awosCache.station,
            rawReport: awosCache.rawReport,
            official: awosCache.official, // 👈 Now appears right below rawReport
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

        res.json(reordered);

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

