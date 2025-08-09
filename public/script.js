let countdown = 60;
const countdownDisplay = document.getElementById('countdown');
const refreshButton = document.getElementById('manual-refresh');

async function fetchAWOS() {
  // Your existing fetch logic here
    console.log("Fetching AWOS data...");
    try {
        const res = await fetch('/latest-awos');
        const data = await res.json();
        updateAWOSUI(data);
    } catch (err) {
        console.error('AWOS fetch failed:', err);
    }
    // Reset countdown after manual refresh
     countdown = 60;
}

function safeSetText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function updateAWOSUI(data) {
  const lat = typeof data.station.lat === 'number' ? data.station.lat : 0;
  const long = typeof data.station.long === 'number' ? data.station.long : 0;

  safeSetText('station-id', data.station.id);
  safeSetText('station-elevation', `${data.station.elevation} ft (${data.station.elevationM} m)`);
  safeSetText('station-lat', `${lat.toFixed(5)}° N`);
  safeSetText('station-long', `${Math.abs(long).toFixed(5)}° ${long < 0 ? 'W' : 'E'}`);

  safeSetText('temperature', data.temperature);
  safeSetText('dew-point', data.dewPoint);
  safeSetText('spread', data.spread);
  safeSetText('humidex', data.humidex);
  safeSetText('wind-chill', data.windChill);

  safeSetText('wind-2min', `${data.wind['2min'].dir}° ${data.wind['2min'].speed} KT Gust ${data.wind['2min'].gust}`);
  safeSetText('wind-10min', `${data.wind['10min'].dir}° ${data.wind['10min'].speed} KT Gust ${data.wind['10min'].gust}`);
  safeSetText('wind-60min', `${data.wind['60min'].dir}° ${data.wind['60min'].speed} KT Gust ${data.wind['60min'].gust}`);
  safeSetText('wind-variable', data.wind.variable);
  safeSetText('gust-time', data.wind.gustTime);

  safeSetText('altimeter', data.altimeter);
  safeSetText('msl', data.msl);
  safeSetText('station-pressure', data.stationPressure);
  safeSetText('tendency-3hr', data.tendency['3hr']);
  safeSetText('tendency-15min', data.tendency['15min']);
  safeSetText('tendency-1hr', data.tendency['1hr']);

  safeSetText('pressure-altitude', data.pressureAltitude);
  safeSetText('density-altitude', data.densityAltitude);

  safeSetText('visibility-sm', data.visibility.sm);
  safeSetText('visibility-m', data.visibility.m);
  safeSetText('rvr-rwy24', data.rvrRWY24);

  safeSetText('cloud', data.cloud);
  safeSetText('present-weather', data.presentWeather);

  safeSetText('lightning', data.lightning);

  safeSetText('server-time', data.serverTime);
  safeSetText('report-time', data.reportTime);
  safeSetText('raw-report', data.rawReport);
}
function updateCountdown() {
  countdownDisplay.textContent =`${countdown}`;
  countdown--;
  if (countdown < 0) {
    fetchAWOS();
    countdown = 60;
  }
}
// Initial fetch
fetchAWOS();
setInterval(updateCountdown, 1000);
refreshButton.addEventListener('click', fetchAWOS);