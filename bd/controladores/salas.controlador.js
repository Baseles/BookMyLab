// CRUD de salas y laboratorios, más la consulta de disponibilidad por día.
const Sala = require('../modelos/sala.modelo');
const Equipo = require('../modelos/equipo.modelo');
const Reserva = require('../modelos/reserva.modelo');
const HttpError = require('../utils/HttpError');
const { tomarCampos, escaparRegex } = require('../utils/datos');
const { rangoDelDia, horaDe } = require('../utils/horario');
const { ESTADOS_ACTIVOS } = require('../config/catalogos');

const CAMPOS = ['clave', 'nombre', 'tipo', 'edificio', 'capacidad', 'horaApertura', 'horaCierre', 'disponible', 'descripcion'];
const ORDENES = {
  clave: { clave: 1 },
  nombre: { nombre: 1 },
  capacidad: { capacidad: 1 },
  '-capacidad': { capacidad: -1 },
};

const filtroProximas = (salaId) => ({ sala: salaId, estado: { $in: ESTADOS_ACTIVOS }, fin: { $gt: new Date() } });

// GET /api/salas?buscar=&tipo=&edificio=&capacidadMin=&disponible=&orden=
async function listar(req, res, next) {
  try {
    const { buscar, tipo, edificio, capacidadMin, disponible, orden } = req.query;
    const filtro = {};
    if (buscar) {
      const rx = new RegExp(escaparRegex(buscar.trim()), 'i');
      filtro.$or = [{ nombre: rx }, { clave: rx }];
    }
    if (tipo) filtro.tipo = tipo;
    if (edificio) filtro.edificio = edificio.trim().toUpperCase();
    if (capacidadMin) {
      const min = Number(capacidadMin);
      if (!Number.isFinite(min)) throw new HttpError(400, 'capacidadMin debe ser un número');
      filtro.capacidad = { $gte: min };
    }
    if (disponible === 'true' || disponible === 'false') filtro.disponible = disponible === 'true';

    const salas = await Sala.find(filtro)
      .select('-createdAt -updatedAt')
      .sort(ORDENES[orden] || ORDENES.clave)
      .lean();
    res.json(salas);
  } catch (err) {
    next(err);
  }
}

// GET /api/salas/:id  (incluye los equipos guardados en la sala)
async function obtener(req, res, next) {
  try {
    const sala = await Sala.findById(req.params.id).lean();
    if (!sala) throw new HttpError(404, 'Sala no encontrada');
    const equipos = await Equipo.find({ sala: sala._id }).select('noInventario nombre tipo estado').lean();
    res.json({ ...sala, equipos });
  } catch (err) {
    next(err);
  }
}

// GET /api/salas/:id/disponibilidad?fecha=YYYY-MM-DD  -> horarios ocupados ese día
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

// POST /api/salas
async function crear(req, res, next) {
  try {
    const sala = new Sala(tomarCampos(req.body, CAMPOS));
    await sala.save();
    res.status(201).location(`/api/salas/${sala._id}`).json(sala);
  } catch (err) {
    next(err);
  }
}

// PUT /api/salas/:id
async function actualizar(req, res, next) {
  try {
    const sala = await Sala.findById(req.params.id);
    if (!sala) throw new HttpError(404, 'Sala no encontrada');

    const datos = tomarCampos(req.body, CAMPOS);
    // No se puede cerrar una sala que tiene reservas próximas
    if (datos.disponible === false && sala.disponible) {
      const proximas = await Reserva.countDocuments(filtroProximas(sala._id));
      if (proximas > 0) {
        throw new HttpError(409, `La sala tiene ${proximas} reserva(s) próximas. Cancélalas antes de marcarla como no disponible.`, { disponible: 'Tiene reservas próximas' });
      }
    }

    sala.set(datos);
    await sala.save();
    res.json(sala);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/salas/:id
async function eliminar(req, res, next) {
  try {
    const sala = await Sala.findById(req.params.id);
    if (!sala) throw new HttpError(404, 'Sala no encontrada');

    const [proximas, equipos] = await Promise.all([
      Reserva.countDocuments(filtroProximas(sala._id)),
      Equipo.countDocuments({ sala: sala._id }),
    ]);
    if (proximas > 0) throw new HttpError(409, `La sala ${sala.clave} tiene ${proximas} reserva(s) próximas. Cancélalas primero.`);
    if (equipos > 0) throw new HttpError(409, `La sala ${sala.clave} tiene ${equipos} equipo(s) asignados. Muévelos a otra sala primero.`);

    await Reserva.deleteMany({ sala: sala._id }); // historial de la sala eliminada
    await sala.deleteOne();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtener, disponibilidad, crear, actualizar, eliminar };
