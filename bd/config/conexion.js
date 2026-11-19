const mongoose = require('mongoose');

const opcionesCliente = { serverApi: { version: '1', strict: true, deprecationErrors: true } };

let conexion = null;

mongoose.connection.on('disconnected', () => console.warn('Se perdió la conexión con MongoDB'));
mongoose.connection.on('reconnected', () => console.log('Conexión con MongoDB recuperada'));

function conectarBD() {
  if (!conexion) {
    if (!process.env.MONGO_URI) {
      return Promise.reject(new Error('Falta MONGO_URI. Copia bd/.env.example como bd/.env (o agrégala en Vercel).'));
    }
    conexion = mongoose
      .connect(process.env.MONGO_URI, opcionesCliente)
      .then(async () => {
        await mongoose.connection.db.admin().command({ ping: 1 });
        console.log(`Conectado a MongoDB (${mongoose.connection.name})`);
      })
      .catch((err) => {
        conexion = null; // permite reintentar en la siguiente petición
        throw err;
      });
  }
  return conexion;
}

module.exports = conectarBD;
