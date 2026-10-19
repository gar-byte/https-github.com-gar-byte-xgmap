(() => {
  const USGS_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';
  const map = L.map('map', { preferCanvas: true }).setView([20, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const clusterGroup = L.markerClusterGroup();
  map.addLayer(clusterGroup);

  const hoursInput = document.getElementById('hours');
  const hoursLabel = document.getElementById('hoursLabel');
  const refreshBtn = document.getElementById('refreshBtn');
  const installBtn = document.getElementById('installBtn');
  const listEl = document.getElementById('list');

  let events = [];
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'inline-block';
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.style.display = 'none';
  });

  hoursInput.addEventListener('input', () => {
    hoursLabel.textContent = hoursInput.value;
    render();
  });

  refreshBtn.addEventListener('click', fetchAndRender);

  function withinHours(ts, h) {
    const age = (Date.now() - ts) / (1000 * 60 * 60);
    return age <= h;
  }

  function niceTime(ts) {
    return new Date(ts).toLocaleString();
  }

  function render() {
    clusterGroup.clearLayers();
    listEl.innerHTML = '';

    const lookback = Number(hoursInput.value) || 1;
    const filtered = events.filter(e => e.geometry && withinHours(e.properties.time, lookback));
    filtered.sort((a, b) => b.properties.time - a.properties.time);

    filtered.forEach(e => {
      const coords = e.geometry.coordinates;
      const lat = coords[1];
      const lon = coords[0];
      if (lat == null || lon == null) return;

      const mag = e.properties.mag || '–';
      const title = e.properties.title || 'Event';

      const marker = L.circleMarker([lat, lon], {
        radius: Math.max(4, (mag || 0) * 2),
        color: mag >= 5 ? '#ff3b30' : mag >= 3 ? '#ffb020' : '#06b6d4',
        fillOpacity: 0.8,
        weight: 1
      });

      marker.bindPopup(`<b>${title}</b><br/>Mag: ${mag}<br/>${niceTime(e.properties.time)}<br/><a href="${e.properties.url}" target="_blank">Source</a>`);
      clusterGroup.addLayer(marker);

      const div = document.createElement('div');
      div.className = 'event';
      div.innerHTML = `<h4>${title}</h4><p>Mag: ${mag} — ${niceTime(e.properties.time)}</p>`;
      div.addEventListener('click', () => {
        map.setView([lat, lon], 6, { animate: true });
      });
      listEl.appendChild(div);
    });

    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="event"><p>No recent events in the selected window.</p></div>';
    }
  }

  async function fetchAndRender() {
    try {
      const res = await fetch(USGS_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('Network error');
      const data = await res.json();
      events = data.features || [];
      render();
    } catch (err) {
      console.error('Fetch error', err);
      render();
    }
  }

  fetchAndRender();
  setInterval(fetchAndRender, 60_000);
  document.addEventListener('touchstart', () => {}, { passive: true });
})();
