const mqtt = require('mqtt');

const client = mqtt.connect('mqtt://broker.hivemq.com:1883', {
  clientId: 'simulator_esp32_' + Math.random().toString(16).substring(2, 8)
});

client.on('connect', () => {
  console.log('📡 Simulator ESP32 terhubung ke broker MQTT!');

  const sampleData = {
    ph: 6.5,
    ec: 1.2,
    suhu: 28.5,
    kelembaban: 75.0,
    volume: 85.0
  };

  setInterval(() => {
    client.publish('polines/ta/hidroponik/sensor', JSON.stringify(sampleData), (err) => {
      if (!err) {
        console.log('📤 Data sensor berhasil dikirim ke MQTT:', sampleData);
      } else {
        console.error('❌ Gagal mengirim data:', err);
      }
    });
  }, 5000);
});