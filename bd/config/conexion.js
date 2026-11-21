const mongoose = require('mongoose');

async function conectarBD() {

  if(mongoose.connection.readyState === 1) return;

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("La conexion ah sido exitosa a mongoDB amen");
  } catch (err) {
    console.log("Error al conectar con el mongoDB repampanos", err);
  }
}

module.exports = conectarBD;