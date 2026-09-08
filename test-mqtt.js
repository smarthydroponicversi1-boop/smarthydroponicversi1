const mqtt = require('mqtt');

// Menggunakan broker publik gratis HiveMQ untuk uji coba script
const brokerUrl = 'mqtt://broker.hivemq.com:1883';

console.log('Mencoba menghubungkan ke broker publik HiveMQ...');
const client = mqtt.connect(brokerUrl, {
  clientId: 'test_node_' + Math.random().toString(16).substring(2, 8)
});

client.on('connect', () => {
  console.log('✅ BERHASIL TERHUBUNG KE BROKER PUBLIK!');
  
  // Coba test publish & subscribe sederhana
  client.subscribe('polines/ta/test', (err) => {
    if (!err) {
      client.publish('polines/ta/test', 'Halo dari Node.js Mahes!');
    }
  });
});

client.on('message', (topic, payload) => {
  console.log(`📩 Pesan diterima di [${topic}]:`, payload.toString());
  client.end();
});

client.on('error', (err) => {
  console.error('❌ GAGAL KONEKSI:', err.message);
});