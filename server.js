const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);

// -------------------------------------------------------------
// 1. KONEKSI MONGODB ATLAS
// -------------------------------------------------------------
const MONGODB_URI = 'mongodb+srv://smarthydroponicv1_db_user:smarthydroponicv1@cluster0.ltlvjct.mongodb.net/hydroponic_db?retryWrites=true&w=majority';

const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('✅ Terhubung ke MongoDB Atlas!');
  } catch (err) {
    console.error('❌ Gagal terhubung ke MongoDB:', err.message);
  }
};

connectDB();

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Terputus dari MongoDB Atlas, mencoba menghubungkan ulang...');
});

const sensorSchema = new mongoose.Schema({
  ph: Number,
  ec: Number,
  suhu: Number,
  kelembaban: Number,
  volume: Number,
  timestamp: { type: Date, default: Date.now }
}, { strict: false });

const SensorData = mongoose.model('SensorData', sensorSchema);

// -------------------------------------------------------------
// 2. INISIALISASI SOCKET.IO & EXPRESS
// -------------------------------------------------------------
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/sensor-history', async (req, res) => {
  try {
    const history = await SensorData.find().sort({ timestamp: -1 }).limit(100);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil riwayat data' });
  }
});

io.on('connection', (socket) => {
  console.log('⚡ Client terhubung via Socket.io:', socket.id);

  socket.on('controlCommand', (data) => {
    console.log('🎮 Perintah diterima dari web:', data.command);
    
    if (mqttClient.connected) {
      mqttClient.publish('polines/ta/hidroponik/kontrol', data.command);
    }

    io.emit('pumpStatus', data.command);
  });

  socket.on('disconnect', () => {
    console.log('❌ Client terputus:', socket.id);
  });
});

// -------------------------------------------------------------
// 3. KONFIGURASI MQTT BROKER PUBLIK (TANPA AUTH)
// -------------------------------------------------------------
const brokerUrl = 'mqtt://broker.hivemq.com:1883';
const mqttClient = mqtt.connect(brokerUrl, {
  clientId: 'nodejs_backend_hydro_' + Math.random().toString(16).substring(2, 8),
  clean: true,
  reconnectPeriod: 2000
});

mqttClient.on('connect', () => {
  console.log('✅ Berhasil Terhubung ke Broker MQTT Publik!');
  
  mqttClient.subscribe('polines/ta/hidroponik/sensor', (err) => {
    if (!err) {
      console.log('📡 Berhasil subscribe ke topik: polines/ta/hidroponik/sensor');
    }
  });
});

mqttClient.on('message', async (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());
    console.log(`[MQTT] Data masuk (${topic}):`, payload);

    io.emit('sensorData', payload);

    if (topic === 'polines/ta/hidroponik/sensor') {
      const newLog = new SensorData(payload);
      await newLog.save();
      console.log('💾 Data sensor berhasil disimpan ke MongoDB Atlas!');
    }

  } catch (err) {
    console.log(`[MQTT] Pesan teks (${topic}):`, message.toString());
  }
});

mqttClient.on('error', (err) => {
  console.error('❌ Error MQTT:', err.message);
});

mqttClient.on('offline', () => {
  console.log('⚠️ Klien MQTT offline');
});

// -------------------------------------------------------------
// 4. JALANKAN SERVER
// -------------------------------------------------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server backend berjalan di http://localhost:${PORT}`);
});