// Datos para la pantalla de inicio: contadores, próximas reservas y salas más usadas.
const Reserva = require('../modelos/reserva.modelo');
const Sala = require('../modelos/sala.modelo');
const Equipo = require('../modelos/equipo.modelo');
const Usuario = require('../modelos/usuario.modelo');
const { ESTADOS_ACTIVOS } = require('../config/catalogos');
const { rangoDelDia, fechaDe } = require('../utils/horario');

// GET /api/resumen
async function resumen(req, res, next) {
  try {
    const ahora = new Date();
    const hoy = rangoDelDia(fechaDe(ahora));
    const hace30 = new Date(ahora.getTime() - 30 * 24 * 3600 * 1000);
    const activas = { $in: ESTADOS_ACTIVOS };

    const [salas, salasDisponibles, equipos, equiposConFalla, usuarios, reservasHoy, pendientes, proximas, salasMasUsadas] = await Promise.all([
      Sala.countDocuments(),
      Sala.countDocuments({ disponible: true }),
      Equipo.countDocuments(),
      Equipo.countDocuments({ estado: { $ne: 'bueno' } }),
      Usuario.countDocuments({ activo: true, rol: { $ne: 'admin' } }),
      Reserva.countDocuments({ estado: activas, inicio: { $gte: hoy.inicio, $lt: hoy.fin } }),
      Reserva.countDocuments({ estado: 'pendiente', fin: { $gt: ahora } }),
      Reserva.find({ estado: activas, fin: { $gt: ahora } })
        .sort({ inicio: 1 })
        .limit(6)
        .populate('usuario', 'nombreCompleto noControl')
        .populate('sala', 'clave nombre')
        .lean(),
      // Agregación: horas reservadas por sala (últimos 30 días en adelante)
      Reserva.aggregate([
        { $match: { estado: activas, inicio: { $gte: hace30 } } },
        {
          $group: {
            _id: '$sala',
            reservas: { $sum: 1 },
            horas: { $sum: { $divide: [{ $subtract: ['$fin', '$inicio'] }, 3600000] } },
          },
        },
        { $sort: { horas: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'salas', localField: '_id', foreignField: '_id', as: 'sala' } },
        { $unwind: '$sala' },
        { $project: { _id: 0, clave: '$sala.clave', nombre: '$sala.nombre', reservas: 1, horas: { $round: ['$horas', 1] } } },
      ]),
    ]);

    res.json({
      contadores: { salas, salasDisponibles, equipos, equiposConFalla, usuarios, reservasHoy, pendientes },
      proximas,
      salasMasUsadas,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { resumen };
