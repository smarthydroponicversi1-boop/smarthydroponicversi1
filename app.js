const socket = io();

// Elemen Status Sistem
const systemLamp = document.getElementById('systemLamp');
const systemStatusText = document.getElementById('systemStatusText');

// Status Koneksi Server & Request State Awal
socket.on('connect', () => {
  if (systemLamp) systemLamp.className = 'lamp lamp-green';
  if (systemStatusText) {
    systemStatusText.innerText = 'ONLINE (Server Terhubung)';
    systemStatusText.style.color = '#2ecc71';
  }
  // Minta status terbaru aktuator dari server saat terhubung
  socket.emit('getInitialState');
});

socket.on('disconnect', () => {
  if (systemLamp) systemLamp.className = 'lamp lamp-red';
  if (systemStatusText) {
    systemStatusText.innerText = 'OFFLINE';
    systemStatusText.style.color = '#e74c3c';
  }
});

// --- FUNGSI NAVIGASI SLIDE TAB ---
function switchSlide(slideId, btnElement) {
  const slides = document.querySelectorAll('.slide-content');
  slides.forEach(slide => slide.classList.remove('active'));

  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach(btn => btn.classList.remove('active'));

  const targetSlide = document.getElementById(slideId);
  if (targetSlide) targetSlide.classList.add('active');

  if (btnElement) btnElement.classList.add('active');
}

// --- INISIALISASI GRAFIK CHART.JS ---
const MAX_DATA_POINTS = 10;

function createChartConfig(label, color) {
  return {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: label,
        data: [],
        borderColor: color,
        backgroundColor: color + '22',
        borderWidth: 2,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        x: { title: { display: true, text: 'Waktu' } },
        y: { beginAtZero: false }
      }
    }
  };
}

let chartSuhu, chartPh, chartEc;

window.addEventListener('DOMContentLoaded', () => {
  const ctxSuhu = document.getElementById('chartSuhu');
  const ctxPh = document.getElementById('chartPh');
  const ctxEc = document.getElementById('chartEc');

  if (ctxSuhu) chartSuhu = new Chart(ctxSuhu, createChartConfig('Suhu (°C)', '#e74c3c'));
  if (ctxPh) chartPh = new Chart(ctxPh, createChartConfig('pH', '#3498db'));
  if (ctxEc) chartEc = new Chart(ctxEc, createChartConfig('EC (mS/cm)', '#2ecc71'));
});

// --- UPDATE DATA SENSOR REAL-TIME (SLIDE 1) ---
socket.on('mqttData', (data) => {
  const timestamp = new Date().toLocaleTimeString();

  if (data.suhu !== undefined) {
    document.getElementById('valSuhu').innerText = data.suhu;
    updateStatusLamp('lampSuhu', 'stSuhu', data.suhu, 20, 30, '°C');
    pushChartData(chartSuhu, timestamp, data.suhu);
  }

  if (data.ph !== undefined) {
    document.getElementById('valPh').innerText = data.ph;
    updateStatusLamp('lampPh', 'stPh', data.ph, 5.5, 6.5, '');
    pushChartData(chartPh, timestamp, data.ph);
  }

  if (data.ec !== undefined) {
    document.getElementById('valEc').innerText = data.ec;
    updateStatusLamp('lampEc', 'stEc', data.ec, 1.2, 2.5, 'mS/cm');
    pushChartData(chartEc, timestamp, data.ec);
  }
});

function pushChartData(chart, label, value) {
  if (!chart) return;
  chart.data.labels.push(label);
  chart.data.datasets[0].data.push(value);

  if (chart.data.labels.length > MAX_DATA_POINTS) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update();
}

function updateStatusLamp(lampId, textId, val, min, max, unit) {
  const lamp = document.getElementById(lampId);
  const text = document.getElementById(textId);
  if (!lamp || !text) return;

  if (val >= min && val <= max) {
    lamp.className = 'lamp lamp-green';
    text.innerText = 'Normal';
    text.style.color = '#2ecc71';
  } else {
    lamp.className = 'lamp lamp-red';
    text.innerText = 'Peringatan!';
    text.style.color = '#e74c3c';
  }
}

// --- KONTROL DAN SINKRONISASI AKTUATOR (SLIDE 2) ---
function updateActuatorUI(actuatorName, state) {
  const mapID = {
    'pompaUtama': { lamp: 'lampPompaUtama', txt: 'txtPompaUtama', switch: 'switchPompaUtama' },
    'pompaA':     { lamp: 'lampPompaA',     txt: 'txtPompaA',     switch: 'switchPompaA' },
    'pompaB':     { lamp: 'lampPompaB',     txt: 'txtPompaB',     switch: 'switchPompaB' },
    'valve':      { lamp: 'lampValve',      txt: 'txtValve',      switch: 'switchValve' }
  };

  const target = mapID[actuatorName];
  if (!target) return;

  const lampEl = document.getElementById(target.lamp);
  const txtEl = document.getElementById(target.txt);
  const switchEl = document.getElementById(target.switch);

  const isActive = (state === true || state === 1 || state === 'ON' || state === '1' || state === 'true');

  if (isActive) {
    if (lampEl) lampEl.className = 'lamp lamp-green';
    if (txtEl) {
      txtEl.innerText = 'ON';
      txtEl.style.color = '#2ecc71';
      txtEl.style.fontWeight = 'bold';
    }
    if (switchEl) switchEl.checked = true;
  } else {
    if (lampEl) lampEl.className = 'lamp lamp-red';
    if (txtEl) {
      txtEl.innerText = 'OFF';
      txtEl.style.color = '#e74c3c';
      txtEl.style.fontWeight = 'normal';
    }
    if (switchEl) switchEl.checked = false;
  }
}

function toggleActuator(actuatorName, state) {
  // Update UI secara instan di browser
  updateActuatorUI(actuatorName, state);

  // Kirim sinyal ke server backend
  socket.emit('controlActuator', {
    actuator: actuatorName,
    state: state,
    name: actuatorName,
    status: state
  });
}

// Balikan status tunggal dari server
socket.on('actuatorStatus', (data) => {
  if (!data) return;
  const name = data.actuator || data.name || data.id;
  const status = (data.state !== undefined) ? data.state : data.status;
  if (name) updateActuatorUI(name, status);
});

// Sinkronisasi massal status awal saat refresh halaman
socket.on('initialActuatorStates', (states) => {
  if (states && typeof states === 'object') {
    Object.keys(states).forEach((actuator) => {
      updateActuatorUI(actuator, states[actuator]);
    });
  }
});

// --- FILTER RIWAYAT DATA (SLIDE 3) ---
function filterHistoryData() {
  const dateVal = document.getElementById('filterDate').value;
  if (!dateVal) {
    alert('Silakan pilih tanggal terlebih dahulu!');
    return;
  }
  socket.emit('getHistory', { date: dateVal });
}

socket.on('historyDataResult', (rows) => {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7">Tidak ada data pada tanggal ini.</td></tr>';
    return;
  }

  let sumSuhu = 0, sumPh = 0, sumEc = 0;

  rows.forEach((row, index) => {
    sumSuhu += Number(row.suhu || 0);
    sumPh += Number(row.ph || 0);
    sumEc += Number(row.ec || 0);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${row.tanggal || '-'}</td>
      <td>${row.waktu || '-'}</td>
      <td>${row.suhu}</td>
      <td>${row.ph}</td>
      <td>${row.ec}</td>
      <td><span class="lamp lamp-green"></span> Terekam</td>
    `;
    tbody.appendChild(tr);
  });

  const count = rows.length;
  document.getElementById('avgSuhu').innerText = (sumSuhu / count).toFixed(1);
  document.getElementById('avgPh').innerText = (sumPh / count).toFixed(1);
  document.getElementById('avgEc').innerText = (sumEc / count).toFixed(1);
});