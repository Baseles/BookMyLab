// Conexión a MongoDB Atlas. La URI se lee de la variable de entorno MONGO_URI (archivo .env).
const mongoose = require('mongoose');

async function conectarBD() {
  if (!process.env.MONGO_URI) {
    console.error('Falta MONGO_URI. Copia bd/.env.example como bd/.env y pon tu cadena de conexión de Atlas.');
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Conectado a MongoDB (${mongoose.connection.name})`);
  } catch (err) {
    console.error('Error al conectar a MongoDB:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => console.warn('Se perdió la conexión con MongoDB'));
  mongoose.connection.on('reconnected', () => console.log('Conexión con MongoDB recuperada'));
}

module.exports = conectarBD;
