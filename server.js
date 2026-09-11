const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);

// 1. Koneksi Database SQLite Lokal (pH, EC, Suhu Air)
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Gagal terhubung ke SQLite:', err.message);
  } else {
    console.log('✅ Terhubung ke Database SQLite Lokal!');
  }
});

// Buat tabel sensor
db.run(`CREATE TABLE IF NOT EXISTS sensor_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ph REAL,
  ec REAL,
  suhuAir REAL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// 2. Inisialisasi Express & Socket.io
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/sensor-history', (req, res) => {
  db.all(`SELECT * FROM sensor_logs ORDER BY timestamp DESC LIMIT 100`, [], (err, rows) => {
    if (err) res.status(500).json({ error: 'Gagal mengambil riwayat' });
    else res.json(rows);
  });
});

// 3. Koneksi MQTT Broker
const brokerUrl = 'mqtt://broker.hivemq.com:1883';
const mqttClient = mqtt.connect(brokerUrl, {
  clientId: 'nodejs_backend_hydro_' + Math.random().toString(16).substring(2, 8),
  clean: true
});

mqttClient.on('connect', () => {
  console.log('✅ Terhubung ke Broker MQTT Publik!');
  mqttClient.subscribe('polines/ta/hidroponik/sensor');
});

mqttClient.on('message', (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());
    console.log(`[MQTT] Data masuk:`, payload);

    io.emit('sensorData', payload);

    // Simpan ke SQLite (pH, EC, suhuAir)
    const { ph, ec, suhuAir } = payload;
    db.run(`INSERT INTO sensor_logs (ph, ec, suhuAir) VALUES (?, ?, ?)`,
      [ph, ec, suhuAir], function(err) {
        if (!err) {
          console.log(`💾 Tersimpan ke SQLite (ID: ${this.lastID})`);
        }
      });
  } catch (e) {}
});

// Simulasi otomatis (pH, EC, suhuAir)
setInterval(() => {
  const dummyData = {
    ph: Number((6.0 + Math.random()).toFixed(1)),
    ec: Number((1.1 + Math.random()).toFixed(1)),
    suhuAir: Number((26 + Math.random()).toFixed(1))
  };
  mqttClient.publish('polines/ta/hidroponik/sensor', JSON.stringify(dummyData));
}, 5000);

// 4. Jalankan Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});