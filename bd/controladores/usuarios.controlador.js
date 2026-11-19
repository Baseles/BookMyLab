// CRUD de usuarios (alumnos y docentes).
const Usuario = require('../modelos/usuario.modelo');
const Reserva = require('../modelos/reserva.modelo');
const Sesion = require('../modelos/sesion.modelo');
const HttpError = require('../utils/HttpError');
const { tomarCampos, escaparRegex } = require('../utils/datos');
const { ESTADOS_ACTIVOS } = require('../config/catalogos');

const CAMPOS = ['noControl', 'nombreCompleto', 'rol', 'carrera', 'semestre', 'email', 'activo'];
const ORDENES = {
  nombre: { nombreCompleto: 1 },
  noControl: { noControl: 1 },
  recientes: { createdAt: -1 },
};

// GET /api/usuarios?buscar=&carrera=&rol=&activo=&orden=
async function listar(req, res, next) {
  try {
    const { buscar, carrera, rol, activo, orden } = req.query;
    const filtro = {};
    if (buscar) {
      const rx = new RegExp(escaparRegex(buscar.trim()), 'i');
      filtro.$or = [{ nombreCompleto: rx }, { noControl: rx }];
    }
    if (carrera) filtro.carrera = carrera;
    if (rol) filtro.rol = rol;
    if (activo === 'true' || activo === 'false') filtro.activo = activo === 'true';

    const usuarios = await Usuario.find(filtro)
      .select('noControl nombreCompleto rol carrera semestre email activo') // proyección
      .sort(ORDENES[orden] || ORDENES.nombre)
      .lean();
    res.json(usuarios);
  } catch (err) {
    next(err);
  }
}

// GET /api/usuarios/:id
async function obtener(req, res, next) {
  try {
    const usuario = await Usuario.findById(req.params.id).lean();
    if (!usuario) throw new HttpError(404, 'Usuario no encontrado');
    res.json(usuario);
  } catch (err) {
    next(err);
  }
}

// GET /api/usuarios/:id/reservas?periodo=proximas|pasadas
async function reservas(req, res, next) {
  try {
    const existe = await Usuario.exists({ _id: req.params.id });
    if (!existe) throw new HttpError(404, 'Usuario no encontrado');

    const filtro = { usuario: req.params.id };
    const ahora = new Date();
    if (req.query.periodo === 'proximas') filtro.fin = { $gt: ahora };
    if (req.query.periodo === 'pasadas') filtro.fin = { $lte: ahora };

    const lista = await Reserva.find(filtro)
      .populate('sala', 'clave nombre edificio')
      .sort({ inicio: -1 })
      .lean();
    res.json(lista);
  } catch (err) {
    next(err);
  }
}

// La contraseña solo se toma si viene escrita; vacía al editar significa "no cambiarla"
function datosUsuario(body) {
  const datos = tomarCampos(body, CAMPOS);
  if (typeof body.password === 'string' && body.password !== '') datos.password = body.password;
  return datos;
}

// POST /api/usuarios
async function crear(req, res, next) {
  try {
    const usuario = new Usuario(datosUsuario(req.body));
    await usuario.save();
    res.status(201).location(`/api/usuarios/${usuario._id}`).json(usuario);
  } catch (err) {
    next(err);
  }
}

// PUT /api/usuarios/:id
async function actualizar(req, res, next) {
  try {
    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) throw new HttpError(404, 'Usuario no encontrado');
    if (String(usuario._id) === String(req.usuario._id) && (req.body.rol && req.body.rol !== 'admin' || req.body.activo === false)) {
      throw new HttpError(409, 'No puedes quitarte el rol de admin ni desactivar tu propia cuenta');
    }
    usuario.set(datosUsuario(req.body));
    const cambioClave = usuario.isModified('password');
    await usuario.save(); // save() ejecuta todas las validaciones del esquema
    // Con contraseña nueva, se cierran las sesiones abiertas de esa persona (menos la propia)
    if (cambioClave) await Sesion.deleteMany({ usuario: usuario._id, _id: { $ne: req.sesionId } });
    res.json(usuario);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/usuarios/:id
async function eliminar(req, res, next) {
  try {
    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) throw new HttpError(404, 'Usuario no encontrado');
    if (String(usuario._id) === String(req.usuario._id)) throw new HttpError(409, 'No puedes eliminar tu propia cuenta');

    const proximas = await Reserva.countDocuments({
      usuario: usuario._id,
      estado: { $in: ESTADOS_ACTIVOS },
      fin: { $gt: new Date() },
    });
    if (proximas > 0) {
      throw new HttpError(409, `${usuario.nombreCompleto} tiene ${proximas} reserva(s) próximas. Cancélalas primero o márcalo como inactivo.`);
    }

    await Reserva.deleteMany({ usuario: usuario._id }); // su historial ya no tiene a quién apuntar
    await Sesion.deleteMany({ usuario: usuario._id });
    await usuario.deleteOne();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtener, reservas, crear, actualizar, eliminar };
