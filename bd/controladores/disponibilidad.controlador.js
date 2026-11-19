// Horarios ocupados de una sala en un día. Lo usa la pantalla de Reservas para dibujar
// la línea de tiempo. No es parte del CRUD.
const Sala = require('../modelos/sala.modelo');
const Reserva = require('../modelos/reserva.modelo');
const HttpError = require('../utils/HttpError');
const { rangoDelDia, horaDe } = require('../utils/horario');
const { ESTADOS_ACTIVOS } = require('../config/catalogos');

// GET /api/salas/:id/disponibilidad?fecha=YYYY-MM-DD
async function disponibilidad(req, res, next) {
  try {
    const rango = rangoDelDia(req.query.fecha);
    if (!rango) throw new HttpError(400, 'Indica la fecha con formato YYYY-MM-DD', { fecha: 'Fecha inválida' });

    const sala = await Sala.findById(req.params.id).select('clave nombre capacidad horaApertura horaCierre disponible').lean();
    if (!sala) throw new HttpError(404, 'Sala no encontrada');

    const ocupadas = await Reserva.find({
      sala: sala._id,
      estado: { $in: ESTADOS_ACTIVOS },
      inicio: { $lt: rango.fin },
      fin: { $gt: rango.inicio },
    })
      .select('inicio fin estado usuario motivo')
      .populate('usuario', 'nombreCompleto noControl')
      .sort({ inicio: 1 })
      .lean();

    res.json({
      sala,
      fecha: req.query.fecha,
      ocupado: ocupadas.map((r) => ({
        _id: r._id,
        horaInicio: horaDe(r.inicio),
        horaFin: horaDe(r.fin),
        estado: r.estado,
        motivo: r.motivo,
        usuario: r.usuario,
      })),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { disponibilidad };
