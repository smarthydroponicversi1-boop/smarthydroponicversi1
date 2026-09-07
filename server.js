const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Inisialisasi Socket.io dengan CORS terbuka
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

// Handling Koneksi Socket.io dari Web Client
io.on('connection', (socket) => {
  console.log('⚡ Client terhubung via Socket.io:', socket.id);

  // Menerima perintah tombol kontrol dari dashboard web
  socket.on('controlCommand', (data) => {
    console.log('🎮 Perintah diterima dari web:', data.command);
    
    // 1. Publish perintah ke topik MQTT agar dibaca oleh ESP32
    mqttClient.publish('hidroponik/kontrol/pompa', data.command);

    // 2. Broadcast balik status pompa ke semua client web secara instant
    io.emit('pumpStatus', data.command);
  });

  socket.on('disconnect', () => {
    console.log('❌ Client terputus:', socket.id);
  });
});

// Konfigurasi HiveMQ Cloud Broker
const brokerUrl = 'mqtts://d6c3e7f55ab046e4ad3b0230393872d3.s1.eu.hivemq.cloud:8883';
const options = {
  clientId: 'nodejs_backend_' + Math.random().toString(16).substr(2, 8),
  username: 'hidroponik_user',
  password: 'Password123', // Pastikan disesuaikan dengan password HiveMQ Anda
  rejectUnauthorized: true
};

const mqttClient = mqtt.connect(brokerUrl, options);

mqttClient.on('connect', () => {
  console.log('✅ Terhubung ke HiveMQ Cloud Broker!');
  mqttClient.subscribe('hidroponik/sensor');
  mqttClient.subscribe('hidroponik/status/#');
});

mqttClient.on('message', (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());
    console.log(`[MQTT] Data masuk (${topic}):`, payload);
    // Kirim data telemetry ke frontend via Socket.io
    io.emit('sensorData', payload);
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