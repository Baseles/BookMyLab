// CRUD del inventario de equipo prestable.
const Equipo = require('../modelos/equipo.modelo');
const Sala = require('../modelos/sala.modelo');
const Reserva = require('../modelos/reserva.modelo');
const HttpError = require('../utils/HttpError');
const { tomarCampos, escaparRegex } = require('../utils/datos');
const { ESTADOS_ACTIVOS } = require('../config/catalogos');

const CAMPOS = ['noInventario', 'nombre', 'tipo', 'estado', 'sala', 'notas'];
const ORDENES = {
  nombre: { nombre: 1 },
  noInventario: { noInventario: 1 },
  estado: { estado: 1, nombre: 1 },
};

const filtroProximas = (equipoId) => ({ equipos: equipoId, estado: { $in: ESTADOS_ACTIVOS }, fin: { $gt: new Date() } });

async function verificarSala(salaId) {
  if (salaId && !(await Sala.exists({ _id: salaId }))) {
    throw new HttpError(400, 'La sala indicada no existe', { sala: 'La sala no existe' });
  }
}

// GET /api/equipos?buscar=&tipo=&estado=&sala=&orden=
async function listar(req, res, next) {
  try {
    const { buscar, tipo, estado, sala, orden } = req.query;
    const filtro = {};
    if (buscar) {
      const rx = new RegExp(escaparRegex(buscar.trim()), 'i');
      filtro.$or = [{ nombre: rx }, { noInventario: rx }];
    }
    if (tipo) filtro.tipo = tipo;
    if (estado) filtro.estado = estado;
    if (sala) filtro.sala = sala;

    const equipos = await Equipo.find(filtro)
      .populate('sala', 'clave nombre edificio')
      .select('-createdAt -updatedAt')
      .sort(ORDENES[orden] || ORDENES.nombre)
      .lean();
    res.json(equipos);
  } catch (err) {
    next(err);
  }
}

// GET /api/equipos/:id
async function obtener(req, res, next) {
  try {
    const equipo = await Equipo.findById(req.params.id).populate('sala', 'clave nombre edificio').lean();
    if (!equipo) throw new HttpError(404, 'Equipo no encontrado');
    res.json(equipo);
  } catch (err) {
    next(err);
  }
}

// POST /api/equipos
async function crear(req, res, next) {
  try {
    const datos = tomarCampos(req.body, CAMPOS);
    await verificarSala(datos.sala);
    const equipo = new Equipo(datos);
    await equipo.save();
    await equipo.populate('sala', 'clave nombre edificio');
    res.status(201).location(`/api/equipos/${equipo._id}`).json(equipo);
  } catch (err) {
    next(err);
  }
}

// PUT /api/equipos/:id
// Si el equipo se marca como dañado o en reparación, se quita de las reservas próximas
// y la respuesta indica cuántas se vieron afectadas.
async function actualizar(req, res, next) {
  try {
    const equipo = await Equipo.findById(req.params.id);
    if (!equipo) throw new HttpError(404, 'Equipo no encontrado');

    const datos = tomarCampos(req.body, CAMPOS);
    await verificarSala(datos.sala);
    equipo.set(datos);
    await equipo.save();

    let reservasAfectadas = 0;
    if (equipo.estado !== 'bueno') {
      const resultado = await Reserva.updateMany(filtroProximas(equipo._id), { $pull: { equipos: equipo._id } });
      reservasAfectadas = resultado.modifiedCount;
    }

    await equipo.populate('sala', 'clave nombre edificio');
    res.json({ ...equipo.toObject(), reservasAfectadas });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/equipos/:id
async function eliminar(req, res, next) {
  try {
    const equipo = await Equipo.findById(req.params.id);
    if (!equipo) throw new HttpError(404, 'Equipo no encontrado');

    const proximas = await Reserva.countDocuments(filtroProximas(equipo._id));
    if (proximas > 0) {
      throw new HttpError(409, `${equipo.nombre} está apartado en ${proximas} reserva(s) próximas. Márcalo como dañado o espera a que terminen.`);
    }

    await Reserva.updateMany({ equipos: equipo._id }, { $pull: { equipos: equipo._id } });
    await equipo.deleteOne();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
