const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);

// -------------------------------------------------------------
// KONEKSI MONGO DB ATLAS & SCHEMA
// -------------------------------------------------------------
// Standard Connection String (Bypass DNS SRV Windows) dengan nama replicaSet yang sesuai
const MONGODB_URI = 'mongodb://smarthydroponicv1_db_user:yX0UGvGqS2AdU30H@cluster0-shard-00-00.ltlvjct.mongodb.net:27017,cluster0-shard-00-01.ltlvjct.mongodb.net:27017,cluster0-shard-00-02.ltlvjct.mongodb.net:27017/hydroponic_db?ssl=true&replicaSet=atlas-ltlvjct-shard-0&authSource=admin&retryWrites=true&w=majority';

// Fungsi Koneksi dengan Auto-Retry
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ Terhubung ke MongoDB Atlas!');
  } catch (err) {
    console.error('❌ Gagal terhubung ke MongoDB:', err.message);
  }
};

connectDB();

// Event Listener Mongoose
mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Terputus dari MongoDB Atlas, mencoba menghubungkan ulang...');
});

// Schema Data Sensor
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
// INISIALISASI SOCKET.IO
// -------------------------------------------------------------
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware & Static Files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Route Halaman Utama
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Route API untuk Mengambil Riwayat Sensor ke Dashboard
app.get('/api/sensor-history', async (req, res) => {
  try {
    const history = await SensorData.find().sort({ timestamp: -1 }).limit(100);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil riwayat data' });
  }
});

// Handling Koneksi Socket.io
io.on('connection', (socket) => {
  console.log('⚡ Client terhubung via Socket.io:', socket.id);

  socket.on('controlCommand', (data) => {
    console.log('🎮 Perintah diterima dari web:', data.command);
    
    if (mqttClient.connected) {
      mqttClient.publish('hidroponik/kontrol/pompa', data.command);
    }

    io.emit('pumpStatus', data.command);
  });

  socket.on('disconnect', () => {
    console.log('❌ Client terputus:', socket.id);
  });
});

// -------------------------------------------------------------
// KONFIGURASI HIVEMQ CLOUD BROKER
// -------------------------------------------------------------
const brokerUrl = 'mqtts://d6c3e7f55ab046e4ad3b0230393872d3.s1.eu.hivemq.cloud:8883';
const options = {
  clientId: 'nodejs_backend_' + Math.random().toString(16).substr(2, 8),
  username: 'smarthydroponicv1',
  password: 'SmartHydroponicv1Katasandi',
  rejectUnauthorized: true,
  reconnectPeriod: 1000 // Auto-reconnect jika koneksi terputus
};

const mqttClient = mqtt.connect(brokerUrl, options);

mqttClient.on('connect', () => {
  console.log('✅ Terhubung ke HiveMQ Cloud Broker!');
  mqttClient.subscribe('hidroponik/sensor');
  mqttClient.subscribe('hidroponik/status/#');
});

mqttClient.on('message', async (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());
    console.log(`[MQTT] Data masuk (${topic}):`, payload);

    // Broadcast data ke web client secara real-time
    io.emit('sensorData', payload);

    // Simpan otomatis ke MongoDB Atlas jika topik hidroponik/sensor
    if (topic === 'hidroponik/sensor') {
      const newLog = new SensorData(payload);
      await newLog.save();
      console.log('💾 Data sensor disimpan ke MongoDB Atlas!');
    }

  } catch (err) {
    console.log(`[MQTT] Pesan teks (${topic}):`, message.toString());
  }
});

mqttClient.on('error', (err) => {
  console.error('❌ Gagal terhubung ke HiveMQ Cloud:', err.message);
});

// Jalankan Server HTTP
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
});