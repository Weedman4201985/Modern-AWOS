let countdown = 60;
let cachedAutoMetar = '';

// Controls
const countdownDisplay = document.getElementById('countdown');
const refreshButton = document.getElementById('manual-refresh');
const darkToggle = document.getElementById('dark-mode-toggle');
const fullDataBtn = document.getElementById('view-full-data');

function safeSetText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}
function safeSetHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

function toDMS(deg, isLat) {
    if (typeof deg !== 'number') return '--';
    const abs = Math.abs(deg);
    const d = Math.floor(abs);
    const mFloat = (abs - d) * 60;
    const m = Math.floor(mFloat);
    const s = Math.round((mFloat - m) * 60);
    const hemi = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');
    return `${d}°${String(m).padStart(2,'0')}′${String(s).padStart(2,'0')}″${hemi}`;
}
function calcWetBulb(tempC, dewC) {
    if (typeof tempC !== 'number' || typeof dewC !== 'number') return '--';
    const es = 6.112 * Math.exp((17.67 * tempC) / (tempC + 243.5));
    const e = 6.112 * Math.exp((17.67 * dewC) / (dewC + 243.5));
    const RH = Math.max(0, Math.min(100, (e / es) * 100));
    // Stull approximation (2011)
    const Tw = tempC * Math.atan(0.151977 * Math.sqrt(RH + 8.313659))
        + Math.atan(tempC + RH) - Math.atan(RH - 1.676331)
        + 0.00391838 * Math.pow(RH, 1.5) * Math.atan(0.023101 * RH)
        - 4.686035;
    return Math.round(Tw * 10) / 10;
}

async function fetchAWOS() {
    try {
        const res = await fetch('/latest-awos');
        const data = await res.json();
        updateUI(data);
        window.__awos = data; // for full data modal
    } catch (err) {
        console.error('AWOS fetch failed:', err);
    }
    countdown = 60;
}
function updateUI(data) {
    // Header
    safeSetText('station-id', data.station.id);
    safeSetText('elev-m', `${data.station.elevationM}m`);
    safeSetText('server-time', data.serverTime);
    safeSetText('report-time', data.reportTime);

    // DMS header line
    safeSetText('lat-dms', toDMS(data.station.lat, true));
    safeSetText('long-dms', toDMS(data.station.long, false));

    // METAR auto
    safeSetText('auto-metar', data.rawReport);
    cachedAutoMetar = data.rawReport;


    // Sky & Weather
    safeSetText('cloud', data.cloud);
    safeSetText('present-weather', data.presentWeather);

    // Temperature
    safeSetText('temperature', typeof data.temperature === 'number' ? data.temperature.toFixed(1) : data.temperature);
    safeSetText('dew-point', typeof data.dewPoint === 'number' ? data.dewPoint.toFixed(1) : data.dewPoint);
    safeSetText('relative-humidity', `${data.relativeHumidity}`);
    safeSetText('humidex', data.humidex);
    safeSetText('wind-chill', data.windChill);

    const wetBulb = calcWetBulb(data.temperature, data.dewPoint);
    safeSetText('wet-bulb', wetBulb);

    // Visibility
    const sm = data.visibility?.sm ?? '--';
    const m = data.visibility?.m ?? '--';
    safeSetText('visibility-combined', `${sm} SM / ${m} m`);
    safeSetText('rvr-rwy24', data.rvrRWY24);

    // Pressure
    safeSetText('altimeter', typeof data.altimeter === 'number' ? data.altimeter.toFixed(2) : data.altimeter);
    safeSetText('msl-raw', data.mslRaw);
    safeSetText('station-pressure', data.stationPressure);
    safeSetText('density-altitude', data.densityAltitude);
    safeSetText('pressure-altitude', data.pressureAltitude);

    // Wind (True/Mag/Variability)
    const w2 = data.wind['2min'];
    const w10 = data.wind['10min'];
    const w60 = data.wind['60min'];

    const trueStr = `2m: ${w2.true}° @ ${w2.speed}kt, G${w2.gust} | 10m: ${w10.true}° @ ${w10.speed}kt | 60m: ${w60.true}° @ ${w60.speed}kt`;
    const magStr  = `2m: ${w2.mag}° @ ${w2.speed}kt, G${w2.gust} | 10m: ${w10.mag}° @ ${w10.speed}kt | 60m: ${w60.mag}° @ ${w60.speed}kt`;

    safeSetText('wind-true', trueStr.replace(/undefined|NaN|--°/g, '--'));
    safeSetText('wind-mag',  magStr.replace(/undefined|NaN|--°/g, '--'));
    safeSetText('wind-var-range', data.wind.variabilityRange || data.wind.variable || '--');

    // Lightning
    safeSetText('lightning', data.lightning);
    safeSetText('closest-strike', data.closestStrike || 'n/a');
}
function updateCountdown() {
    countdownDisplay.textContent = `${countdown}`;
    countdown--;
    if (countdown < 0) {
        fetchAWOS();
        countdown = 60;
    }
}
function getOfficialMetar(data) {
    return data?.official?.metar?.raw || 'METAR not available';
}

function showModal() {
    fetch('/raw-xml')
        .then(res => res.text())
        .then(xml => {
            const escapedXml = escapeXml(xml);
            safeSetHtml('xmlContent', escapedXml);
            Prism.highlightElement(document.getElementById('xmlContent'));
            document.getElementById('xmlModal').style.display = 'block';
        })
        .catch(err => {
            safeSetText('xmlContent', 'Failed to load XML.');
            console.error('Error fetching raw XML:', err);
        });
}
function escapeXml(xml) {
    return xml
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
function closeModal() {
    document.getElementById('xmlModal').style.display = 'none';
}

// Full data modal content
function openFullDataModal() {
    const d = window.__awos;
    if (!d) return;
    const html = `
    <div class="card">
      <h3>Temperature Spread</h3>
      <p>${d.spread} °C</p>
    </div>
    <div class="card">
      <h3>Pressure Tendencies</h3>
      <p>3hr: ${d.tendency['3hr']}</p>
      <p>15min: ${d.tendency['15min']}</p>
      <p>1hr: ${d.tendency['1hr']}</p>
    </div>
    <div class="card">
      <h3>Wind (10-min, 60-min)</h3>
      <p>10-min: ${d.wind['10min'].mag}° @ ${d.wind['10min'].speed}kt</p>
      <p>60-min: ${d.wind['60min'].mag}° @ ${d.wind['60min'].speed}kt</p>
    </div>
    <div class="card">
      <h3>Visibility Min-Max</h3>
      <p>Min: ${d.visibility.min} m</p>
      <p>Max: ${d.visibility.max} m</p>
    </div>
    <div class="card">
      <h3>Temperature Trends</h3>
      <p>1hr: ${d.tempTrend1hr}</p>
      <p>3hr: ${d.tempTrend3hr}</p>
      <p>12hr: ${d.temp12hr}</p>
    </div>
    <div class="card">
      <h3>Sensor status and SCADA alarms</h3>
      <p>--</p>
    </div>
  `;
    safeSetHtml('full-data-content', html);
    document.getElementById('fullDataModal').style.display = 'block';
}

setInterval(updateCountdown, 1000);
// Event wiring
refreshButton.addEventListener('click', fetchAWOS);
darkToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
});
fullDataBtn.addEventListener('click', openFullDataModal);
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('metarTafModal');
    const btn = document.getElementById('metar-taf-toggle');
    const close = document.getElementById('metarTafClose');

    btn.addEventListener('click', async () => {
        const isOpen = getComputedStyle(modal).display !== 'none';
        modal.style.display = isOpen ? 'none' : 'grid';
        btn.textContent = isOpen ? '📄 View METAR/TAF' : '📄 Hide METAR/TAF';

        if (!isOpen) {
            safeSetText('modal-auto-metar', cachedAutoMetar || 'AUTO METAR not available');
            safeSetText('modal-official-metar', 'Loading METAR...');
            safeSetText('modal-taf', 'Loading TAF...');

            // On modal open
            const d = window.__awos || {};
            safeSetText('modal-official-metar', d?.official?.metar?.raw || 'METAR not available');
            safeSetText('modal-taf', 'TAF not available');
            safeSetText('modal-taf', d?.official?.taf?.raw || 'TAF not available');
            safeSetText('modal-taf-issued', d?.official?.taf?.issued || '');
        }
    });

    close.addEventListener('click', () => {
        modal.style.display = 'none';
        btn.textContent = '📄 View METAR/TAF';
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            btn.textContent = '📄 View METAR/TAF';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && getComputedStyle(modal).display !== 'none') {
            modal.style.display = 'none';
            btn.textContent = '📄 View METAR/TAF';
        }
    });
});

// Initial load
fetchAWOS();