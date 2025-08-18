let countdown = 30;
let countdownTimer = null;

let isPaused = false;
let autoRefreshEnabled = true;

let cachedAutoMetar = '';
let currentReportIndex = -1;

let awosReports = [];

// Controls
const countdownDisplay = document.getElementById('countdown');
const refreshButton = document.getElementById('manual-refresh');
const darkToggle = document.getElementById('dark-mode-toggle');
const fullDataBtn = document.getElementById('view-full-data');

if (!autoRefreshEnabled) {
    indexEl.textContent += ' (Paused)';
}

function safeSetText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}
function safeSetHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
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

function getOfficialMetar(data) {
    return data?.official?.metar?.raw || 'METAR not available';
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
function parseAWOSTime(str) {
    // Format: YYYYMMDD.HHMMSS
    const match = str.match(/^(\d{4})(\d{2})(\d{2})\.(\d{2})(\d{2})(\d{2})$/);
    if (!match) return new Date();
    const [, y, m, d, h, min, s] = match.map(Number);
    return new Date(Date.UTC(y, m - 1, d, h, min, s));
}
function updateCountdown() {
    if (!autoRefreshEnabled) return;
    countdownDisplay.textContent = countdown;
    countdown--;

    if (countdown < 0) {
        clearInterval(countdownTimer); // ✅ Stop the timer
        fetchHistory();                // ✅ Refresh data
    }
}

function updateReportIndex() {
    const total = awosReports.length;
    const current = currentReportIndex + 1;
    const report = awosReports[currentReportIndex];
    const timeStr = formatReportTime(report?.reportTime);
    const statusStr = report?.isNew ? 'New Data' : 'No Change';

    // Update individual spans
    document.getElementById('report-number').textContent = current;
    document.getElementById('report-total').textContent = total;
    document.getElementById('report-time-label').textContent = timeStr;

    const statusEl = document.getElementById('report-status');
    statusEl.textContent = statusStr;

    // Apply color class
    statusEl.className = report?.isNew ? 'status-new' : 'status-unchanged';

    // Add paused label if needed
    if (!autoRefreshEnabled) {
        statusEl.textContent += ' (Paused)';
    }
}
function formatReportTime(raw) {
    if (!raw || raw.length !== 15) return '--';
    const year = raw.slice(0, 4);
    const month = raw.slice(4, 6);
    const day = raw.slice(6, 8);
    const hour = raw.slice(9, 11);
    const minute = raw.slice(11, 13);
    const second = raw.slice(13, 15);
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}
function showFirstReport() {
    if (awosReports.length) {
        currentReportIndex = 0;
        updateUI(awosReports[currentReportIndex]);
        updateReportIndex();
    }
}
function showPrevReport() {
    if (currentReportIndex > 0) {
        currentReportIndex--;
        updateUI(awosReports[currentReportIndex]);
        updateReportIndex();
    }
}
function showNextReport() {
    if (currentReportIndex < awosReports.length - 1) {
        currentReportIndex++;
        updateUI(awosReports[currentReportIndex]);
        updateReportIndex();
    }
}
function showLastReport() {
    if (awosReports.length) {
        currentReportIndex = awosReports.length - 1;
        updateUI(awosReports[currentReportIndex]);
        updateReportIndex();
    }
}
function isReportNew(current, previous) {
    if (!current || !previous) return false;

    return (
        current.temperature !== previous.temperature ||
        current.dewPoint !== previous.dewPoint ||
        current.relativeHumidity !== previous.relativeHumidity ||
        current.wind?.['2min']?.mag !== previous.wind?.['2min']?.mag ||
        current.wind?.['2min']?.speed !== previous.wind?.['2min']?.speed ||
        current.visibility?.m !== previous.visibility?.m ||
        current.cloud !== previous.cloud ||
        current.altimeter !== previous.altimeter
    );
}
function toggleAutoRefresh() {
    autoRefreshEnabled = !autoRefreshEnabled;
    const btn = document.getElementById('pauseReport');
    btn.textContent = autoRefreshEnabled ? '⏸️ Pause' : '▶️ Resume';

    const indexEl = document.getElementById('report-index');
    if (indexEl) {
        updateReportIndex(); // this will append "(Paused)" if needed
    }
}



async function fetchHistory() {
    try {
        const res = await fetch('/awos-history');
        const data = await res.json();
        const newCount = awosReports.filter(r => r.isNew).length;
        awosReports = data;
        for (let i = 1; i < awosReports.length; i++) {
            awosReports[i].isNew = isReportNew(awosReports[i], awosReports[i - 1]);
        }
        currentReportIndex = awosReports.length - 1;
        updateUI(awosReports[currentReportIndex]);
        updateReportIndex();
        console.log(`${newCount} of ${awosReports.length} reports contained new data`);
    } catch (err) {
        console.error('Fetch failed:', err);
    }

    // ✅ Reset countdown safely
    clearInterval(countdownTimer);   // Stop any previous timer
    countdown = 30;
    countdownDisplay.textContent = countdown;
    if (autoRefreshEnabled) {
        countdownTimer = setInterval(updateCountdown, 1000);
    }
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
async function fetchAWOS() {
    if (!autoRefreshEnabled) return;
    try {
        const res = await fetch('/latest-awos');
        const data = await res.json();
        updateUI(data);
        window.__awos = data;

        // ⏱️ Smart countdown based on report time
        const reportTimeStr = data.reportTime; // e.g., "20250816.181212"
        const reportTime = parseAWOSTime(reportTimeStr);
        const nextExpected = new Date(reportTime.getTime() + 60000); // +60 sec
        const now = new Date();
        const delayMs = Math.max(nextExpected - now, 10000); // minimum 10s
        countdown = Math.floor(delayMs / 1000);
        setTimeout(fetchAWOS, delayMs);


    } catch (err) {
        console.error('AWOS fetch failed:', err);
        countdown = 60; // fallback
        setTimeout(fetchAWOS, 60000);
    }
}


// Event wiring
refreshButton.addEventListener('click', fetchHistory);
darkToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
});
fullDataBtn.addEventListener('click', openFullDataModal);

// DOM Content Controller
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('metarTafModal');
    const btn = document.getElementById('metar-taf-toggle');
    const close = document.getElementById('metarTafClose');
    const chkNewFilter = document.getElementById('filter-new-only');

    let filteredReports = [];

    function bindButtons() {
        document.getElementById('firstReport').onclick = showFirstReport;
        document.getElementById('prevReport').onclick = showPrevReport;
        document.getElementById('nextReport').onclick = showNextReport;
        document.getElementById('lastReport').onclick = showLastReport;
        document.getElementById('pauseReport').onclick = toggleAutoRefresh;
    }

    chkNewFilter.addEventListener('change', (e) => {
        const showOnlyNew = e.target.checked;
        filteredReports = showOnlyNew
            ? awosReports.filter(r => r.isNew)
            : awosReports;

        currentReportIndex = filteredReports.length - 1;
        updateUI(filteredReports[currentReportIndex]);
        updateReportIndex();
    });

    btn.addEventListener('click', async () => {
        const isOpen = getComputedStyle(modal).display !== 'none';
        modal.style.display = isOpen ? 'none' : 'grid';
        btn.textContent = isOpen ? '📄 View METAR/TAF' : '📄 Hide METAR/TAF';

        if (!isOpen) {
            safeSetText('modal-auto-metar', cachedAutoMetar || 'AUTO METAR not available');
            safeSetText('modal-official-metar', 'Loading METAR...');
            safeSetText('modal-taf', 'Loading TAF...');

            try {
                const res = await fetch('/latest-awos');
                const d = await res.json();
                window.__awos = d;

                safeSetText('modal-official-metar', d?.official?.metar?.raw || 'METAR not available');
                safeSetText('modal-taf', d?.official?.taf?.raw || 'TAF not available');
                safeSetText('modal-taf-issued', d?.official?.taf?.issued || '');
            } catch (err) {
                console.error('AWOS fetch failed:', err);
                safeSetText('modal-official-metar', 'METAR fetch error');
                safeSetText('modal-taf', 'TAF fetch error');
            }
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

    // Initial fetch and button binding
    fetchHistory();
    bindButtons();
});

// Initial load
fetchHistory(); // Load history and start at latest
