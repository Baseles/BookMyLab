// Servidor Express de BookMyLab: sirve la página web (html/, css/, js/, img/) y la API REST en /api.
require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });

const path = require('path');
const express = require('express');
const conectarBD = require('./config/conexion');
const rutas = require('./rutas');
const registro = require('./middlewares/registro');
const { noEncontrado, manejadorErrores } = require('./middlewares/errores');

const app = express();
const PORT = process.env.PORT || 3000;
const RAIZ = path.join(__dirname, '..');

// Middlewares globales
app.use(express.json({ limit: '100kb' }));

// Frontend estático
app.use(express.static(path.join(RAIZ, 'html'), { extensions: ['html'] }));
app.use('/css', express.static(path.join(RAIZ, 'css')));
app.use('/js', express.static(path.join(RAIZ, 'js')));
app.use('/img', express.static(path.join(RAIZ, 'img')));

// API REST
app.use('/api', registro, rutas);

// Errores
app.use('/api', noEncontrado);
app.use((req, res) => res.status(404).sendFile(path.join(RAIZ, 'html', '404.html')));
app.use(manejadorErrores);

conectarBD().then(() => {
  app.listen(PORT, () => console.log(`BookMyLab en http://localhost:${PORT}`));
});
