// Punto de entrada de la API (/api). Monta las rutas de cada recurso.
const { Router } = require('express');
const mongoose = require('mongoose');
const catalogos = require('../config/catalogos');
const { resumen } = require('../controladores/resumen.controlador');
const { autenticar, soloAdmin, adminParaEscribir } = require('../middlewares/autenticacion');

const router = Router();

// Estado del servidor y de la conexión a MongoDB
router.get('/salud', (req, res) => {
  const estados = ['desconectada', 'conectada', 'conectando', 'desconectando'];
  res.json({ ok: true, bd: estados[mongoose.connection.readyState] });
});

// Listas para llenar los <select> del frontend
router.get('/catalogos', (req, res) => {
  const { CARRERAS, ROLES, TIPOS_SALA, TIPOS_EQUIPO, ESTADOS_EQUIPO, ESTADOS_RESERVA, REGLAS } = catalogos;
  res.json({ CARRERAS, ROLES, TIPOS_SALA, TIPOS_EQUIPO, ESTADOS_EQUIPO, ESTADOS_RESERVA, REGLAS });
});

// Inicio y cierre de sesión
router.use('/auth', require('./auth.rutas'));

// De aquí en adelante todo requiere sesión iniciada
router.use(['/resumen', '/usuarios', '/salas', '/equipos', '/reservas'], autenticar);

router.get('/resumen', soloAdmin, resumen);
router.use('/usuarios', soloAdmin, require('./usuarios.rutas'));
router.use('/salas', adminParaEscribir, require('./salas.rutas'));
router.use('/equipos', adminParaEscribir, require('./equipos.rutas'));
router.use('/reservas', require('./reservas.rutas')); // los permisos por dueño se revisan en el controlador

module.exports = router;
