// Conexión a MongoDB (Atlas o local). La URI se lee de la variable de entorno MONGO_URI
// (archivo bd/.env en tu computadora, o Settings → Environment Variables en Vercel).
// La conexión se crea una sola vez y se reutiliza en las siguientes llamadas.
const mongoose = require('mongoose');

// Stable API de Atlas: fija la versión 1 para que el servidor no cambie de comportamiento.
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
