// Arranque local de BookMyLab: conecta a MongoDB y levanta el servidor (npm start).
// En Vercel no se usa este archivo: allá la app entra por api/index.js.
const app = require('./app');
const conectarBD = require('./config/conexion');

const PORT = process.env.PORT || 3000;

conectarBD()
  .then(() => app.listen(PORT, () => console.log(`BookMyLab en http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('Error al conectar a MongoDB:', err.message);
    process.exit(1);
  });
