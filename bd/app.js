process.env.TZ = 'America/Mexico_City';
require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });

const path = require('path');
const express = require('express');
const conectarBD = require('./config/conexion');
const rutas = require('./rutas');
const registro = require('./middlewares/registro');
const { noEncontrado, manejadorErrores } = require('./middlewares/errores');

const app = express();
const RAIZ = path.join(__dirname, '..');

// Middlewares globales
app.use(express.json({ limit: '100kb' }));

// Frontend estático (en Vercel lo sirve Vercel directamente; ver vercel.json)
app.use(express.static(path.join(RAIZ, 'html'), { extensions: ['html'] }));
app.use('/css', express.static(path.join(RAIZ, 'css')));
app.use('/js', express.static(path.join(RAIZ, 'js')));
app.use('/img', express.static(path.join(RAIZ, 'img')));

// Antes de cada petición a la API se asegura la conexión (en Vercel se reutiliza entre peticiones)
async function conBD(req, res, next) {
  try {
    await conectarBD();
    next();
  } catch (err) {
    console.error('Error al conectar a MongoDB:', err.message);
    res.status(503).json({ mensaje: 'No se pudo conectar a la base de datos' });
  }
}

// API REST
app.use('/api', registro, conBD, rutas);

// Errores
app.use('/api', noEncontrado);
app.use((req, res) => res.status(404).sendFile(path.join(RAIZ, 'html', '404.html')));
app.use(manejadorErrores);

module.exports = app;
