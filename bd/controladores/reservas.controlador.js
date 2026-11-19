// CRUD de reservas con las reglas del negocio:
//  - horario dentro del servicio de la sala, de 30 min a 4 h, nunca en el pasado
//  - la sala no puede tener dos reservas que se crucen (409 Conflict)
//  - el usuario no puede estar en dos reservas a la vez
//  - el equipo debe estar en buen estado y no apartado en otro horario que se cruce
//  - un alumno puede tener como máximo 3 reservas próximas activas
const Reserva = require('../modelos/reserva.modelo');
const Usuario = require('../modelos/usuario.modelo');
const Sala = require('../modelos/sala.modelo');
const Equipo = require('../modelos/equipo.modelo');
const HttpError = require('../utils/HttpError');
const { esObjectId, escaparRegex } = require('../utils/datos');
const { aFecha, horaDe, fechaDe, rangoDelDia } = require('../utils/horario');
const { ESTADOS_ACTIVOS, ESTADOS_RESERVA, REGLAS, REGEX_HORA } = require('../config/catalogos');

const POBLAR = [
  { path: 'usuario', select: 'noControl nombreCompleto rol carrera' },
  { path: 'sala', select: 'clave nombre edificio capacidad' },
  { path: 'equipos', select: 'noInventario nombre tipo' },
];

// Cambios de estado permitidos
const TRANSICIONES = {
  pendiente: ['pendiente', 'aprobada', 'rechazada', 'cancelada'],
  aprobada: ['aprobada', 'cancelada'],
  rechazada: [],
  cancelada: [],
};

const rangoTexto = (r) => `${horaDe(r.inicio)} a ${horaDe(r.fin)}`;

// Valida los datos de una reserva contra las reglas del negocio y devuelve el documento listo.
// `idActual` excluye la propia reserva al buscar choques cuando se edita.
async function construirReserva(body, { idActual, revisarPasado = true } = {}) {
  const campos = {};
  const { fecha, horaInicio, horaFin, usuario: usuarioId, sala: salaId } = body;
  const asistentes = Number(body.asistentes);
  const motivo = typeof body.motivo === 'string' ? body.motivo.trim() : '';
  const equipos = [...new Set((Array.isArray(body.equipos) ? body.equipos : []).filter(Boolean).map(String))];

  // 1) Formato
  if (!fecha || !rangoDelDia(fecha)) campos.fecha = 'Selecciona una fecha válida';
  if (!REGEX_HORA.test(horaInicio || '')) campos.horaInicio = 'Hora inválida (HH:MM)';
  if (!REGEX_HORA.test(horaFin || '')) campos.horaFin = 'Hora inválida (HH:MM)';
  if (!esObjectId(usuarioId)) campos.usuario = 'Selecciona quién reserva';
  if (!esObjectId(salaId)) campos.sala = 'Selecciona una sala';
  if (!Number.isInteger(asistentes) || asistentes < 1) campos.asistentes = 'Debe ser un número entero mayor a 0';
  if (motivo.length < 5) campos.motivo = 'Describe el motivo (mínimo 5 caracteres)';
  if (equipos.some((id) => !esObjectId(id))) campos.equipos = 'Equipo inválido';
  if (Object.keys(campos).length) throw new HttpError(400, 'Revisa los datos marcados', campos);

  // 2) Horario
  const inicio = aFecha(fecha, horaInicio);
  const fin = aFecha(fecha, horaFin);
  const minutos = (fin - inicio) / 60000;
  if (minutos <= 0) throw new HttpError(400, 'La hora de fin debe ser después del inicio', { horaFin: 'Debe ser después de la hora de inicio' });
  if (minutos < REGLAS.duracionMinimaMin) throw new HttpError(400, `La reserva debe durar al menos ${REGLAS.duracionMinimaMin} minutos`, { horaFin: `Mínimo ${REGLAS.duracionMinimaMin} minutos` });
  if (minutos > REGLAS.duracionMaximaMin) throw new HttpError(400, `La reserva no puede durar más de ${REGLAS.duracionMaximaMin / 60} horas`, { horaFin: `Máximo ${REGLAS.duracionMaximaMin / 60} horas` });
  if (revisarPasado && inicio < new Date()) throw new HttpError(400, 'No puedes reservar en una fecha u hora que ya pasó', { horaInicio: 'Ya pasó' });

  // 3) Usuario y sala
  const [usuario, sala] = await Promise.all([
    Usuario.findById(usuarioId).select('nombreCompleto rol activo').lean(),
    Sala.findById(salaId).lean(),
  ]);
  if (!usuario) throw new HttpError(400, 'El usuario no existe', { usuario: 'No existe' });
  if (usuario.rol === 'admin') throw new HttpError(400, 'Las reservas se hacen a nombre de un alumno o docente', { usuario: 'Elige un alumno o docente' });
  if (!usuario.activo) throw new HttpError(409, `${usuario.nombreCompleto} está inactivo y no puede reservar`, { usuario: 'Usuario inactivo' });
  if (!sala) throw new HttpError(400, 'La sala no existe', { sala: 'No existe' });
  if (!sala.disponible) throw new HttpError(409, `La sala ${sala.clave} no está disponible por ahora`, { sala: 'No disponible' });
  if (horaInicio < sala.horaApertura || horaFin > sala.horaCierre) {
    throw new HttpError(409, `${sala.clave} da servicio de ${sala.horaApertura} a ${sala.horaCierre}`, { horaInicio: `Horario de la sala: ${sala.horaApertura}–${sala.horaCierre}` });
  }
  if (asistentes > sala.capacidad) {
    throw new HttpError(409, `${sala.clave} tiene capacidad para ${sala.capacidad} personas`, { asistentes: `Máximo ${sala.capacidad}` });
  }

  // 4) Choques de horario: inicio < finNuevo  Y  fin > inicioNuevo
  const solapa = { estado: { $in: ESTADOS_ACTIVOS }, inicio: { $lt: fin }, fin: { $gt: inicio } };
  if (idActual) solapa._id = { $ne: idActual };

  const choqueSala = await Reserva.findOne({ ...solapa, sala: sala._id }).lean();
  if (choqueSala) {
    throw new HttpError(409, `${sala.clave} ya está reservada de ${rangoTexto(choqueSala)} ese día`, { horaInicio: 'Se cruza con otra reserva' });
  }

  const choqueUsuario = await Reserva.findOne({ ...solapa, usuario: usuario._id }).populate('sala', 'clave').lean();
  if (choqueUsuario) {
    throw new HttpError(409, `${usuario.nombreCompleto} ya tiene una reserva en ${choqueUsuario.sala?.clave ?? 'otra sala'} de ${rangoTexto(choqueUsuario)}`, { usuario: 'Ya tiene una reserva a esa hora' });
  }

  // 5) Límite de reservas para alumnos
  if (usuario.rol === 'alumno') {
    const filtroActivas = { usuario: usuario._id, estado: { $in: ESTADOS_ACTIVOS }, fin: { $gt: new Date() } };
    if (idActual) filtroActivas._id = { $ne: idActual };
    const activas = await Reserva.countDocuments(filtroActivas);
    if (activas >= REGLAS.maxReservasAlumno) {
      throw new HttpError(409, `Un alumno puede tener como máximo ${REGLAS.maxReservasAlumno} reservas próximas`, { usuario: 'Límite de reservas alcanzado' });
    }
  }

  // 6) Equipo
  if (equipos.length) {
    const lista = await Equipo.find({ _id: { $in: equipos } }).select('noInventario nombre estado').lean();
    if (lista.length !== equipos.length) throw new HttpError(400, 'Algún equipo seleccionado ya no existe', { equipos: 'Equipo inexistente' });

    const noDisponibles = lista.filter((e) => e.estado !== 'bueno');
    if (noDisponibles.length) {
      const nombres = noDisponibles.map((e) => `${e.nombre} (${e.estado})`).join(', ');
      throw new HttpError(409, `No se puede prestar: ${nombres}`, { equipos: 'Equipo no disponible' });
    }

    const choqueEquipo = await Reserva.findOne({ ...solapa, equipos: { $in: equipos } }).lean();
    if (choqueEquipo) {
      const ocupado = lista.find((e) => choqueEquipo.equipos.some((id) => String(id) === String(e._id)));
      throw new HttpError(409, `${ocupado.nombre} (${ocupado.noInventario}) ya está apartado de ${rangoTexto(choqueEquipo)}`, { equipos: 'Equipo ocupado en ese horario' });
    }
  }

  return { usuario: usuario._id, sala: sala._id, equipos, inicio, fin, asistentes, motivo };
}

// Un alumno o docente solo ve y modifica sus propias reservas (el admin, todas)
function revisarDueno(req, reserva) {
  const duenoId = reserva.usuario?._id ?? reserva.usuario;
  if (!req.esAdmin && String(duenoId) !== String(req.usuario._id)) {
    throw new HttpError(404, 'Reserva no encontrada');
  }
}

// GET /api/reservas?fecha=&desde=&hasta=&sala=&usuario=&noControl=&estado=&periodo=proximas|pasadas&orden=
async function listar(req, res, next) {
  try {
    const { fecha, desde, hasta, sala, usuario, noControl, estado, periodo, orden } = req.query;
    const filtro = {};

    if (fecha) {
      const dia = rangoDelDia(fecha);
      if (!dia) throw new HttpError(400, 'Fecha inválida, usa YYYY-MM-DD');
      filtro.inicio = { $gte: dia.inicio, $lt: dia.fin };
    } else if (desde || hasta) {
      filtro.inicio = {};
      if (desde) filtro.inicio.$gte = rangoDelDia(desde)?.inicio ?? new Date(NaN);
      if (hasta) filtro.inicio.$lt = rangoDelDia(hasta)?.fin ?? new Date(NaN);
    }
    if (periodo === 'proximas') filtro.fin = { $gt: new Date() };
    if (periodo === 'pasadas') filtro.fin = { $lte: new Date() };
    if (sala) filtro.sala = sala;
    if (estado) filtro.estado = estado;
    if (usuario) filtro.usuario = usuario;

    // Búsqueda por No. de control: primero se buscan los usuarios que coinciden
    if (noControl && req.esAdmin) {
      const rx = new RegExp(`^${escaparRegex(noControl.trim())}`, 'i');
      const ids = await Usuario.find({ noControl: rx }).distinct('_id');
      filtro.usuario = { $in: ids };
    }

    if (!req.esAdmin) filtro.usuario = req.usuario._id; // "Mis reservas"

    const reservas = await Reserva.find(filtro)
      .populate(POBLAR)
      .sort(orden === 'recientes' ? { createdAt: -1 } : { inicio: 1 })
      .lean();
    res.json(reservas);
  } catch (err) {
    next(err);
  }
}

// GET /api/reservas/:id
async function obtener(req, res, next) {
  try {
    const reserva = await Reserva.findById(req.params.id).populate(POBLAR).lean();
    if (!reserva) throw new HttpError(404, 'Reserva no encontrada');
    revisarDueno(req, reserva);
    res.json(reserva);
  } catch (err) {
    next(err);
  }
}

// POST /api/reservas  (siempre nace como "pendiente")
async function crear(req, res, next) {
  try {
    const body = req.esAdmin ? req.body : { ...req.body, usuario: String(req.usuario._id) }; // reserva a su nombre
    const datos = await construirReserva(body);
    const reserva = await Reserva.create(datos);
    await reserva.populate(POBLAR);
    res.status(201).location(`/api/reservas/${reserva._id}`).json(reserva);
  } catch (err) {
    next(err);
  }
}

// PUT /api/reservas/:id
// - Solo se modifican reservas pendientes o aprobadas que aún no terminan.
// - Cancelar/rechazar solo cambia el estado.
// - Si una reserva aprobada cambia de sala u horario, vuelve a "pendiente".
async function actualizar(req, res, next) {
  try {
    const reserva = await Reserva.findById(req.params.id);
    if (!reserva) throw new HttpError(404, 'Reserva no encontrada');
    if (!ESTADOS_ACTIVOS.includes(reserva.estado)) {
      throw new HttpError(409, `La reserva está ${reserva.estado} y ya no se puede modificar`);
    }
    if (reserva.fin <= new Date()) throw new HttpError(409, 'La reserva ya terminó y no se puede modificar');

    if (!req.esAdmin) {
      revisarDueno(req, reserva);
      // Alumno/docente: cancela la suya, o la edita solo mientras sigue pendiente. No aprueba ni rechaza.
      const quiere = req.body.estado ?? reserva.estado;
      if (quiere !== 'cancelada' && (reserva.estado !== 'pendiente' || quiere !== 'pendiente')) {
        throw new HttpError(403, reserva.estado === 'pendiente'
          ? 'Solo el administrador puede aprobar o rechazar reservas'
          : 'Una reserva aprobada solo se puede cancelar');
      }
      req.body.usuario = String(req.usuario._id);
    }

    const nuevoEstado = req.body.estado ?? reserva.estado;
    if (!ESTADOS_RESERVA.includes(nuevoEstado)) throw new HttpError(400, 'Estado no válido', { estado: 'Estado no válido' });
    if (!TRANSICIONES[reserva.estado].includes(nuevoEstado)) {
      throw new HttpError(409, `No se puede pasar de "${reserva.estado}" a "${nuevoEstado}"`, { estado: 'Cambio no permitido' });
    }

    if (nuevoEstado === 'cancelada' || nuevoEstado === 'rechazada') {
      reserva.estado = nuevoEstado;
    } else {
      // Se combinan los datos actuales con los recibidos y se vuelve a validar todo
      const combinado = {
        fecha: req.body.fecha ?? fechaDe(reserva.inicio),
        horaInicio: req.body.horaInicio ?? horaDe(reserva.inicio),
        horaFin: req.body.horaFin ?? horaDe(reserva.fin),
        usuario: req.body.usuario ?? String(reserva.usuario),
        sala: req.body.sala ?? String(reserva.sala),
        equipos: req.body.equipos ?? reserva.equipos.map(String),
        asistentes: req.body.asistentes ?? reserva.asistentes,
        motivo: req.body.motivo ?? reserva.motivo,
      };
      const nuevoInicio = aFecha(combinado.fecha, combinado.horaInicio);
      const cambioHorario = !nuevoInicio || nuevoInicio.getTime() !== reserva.inicio.getTime()
        || combinado.horaFin !== horaDe(reserva.fin);
      const cambioSala = String(combinado.sala) !== String(reserva.sala);

      const datos = await construirReserva(combinado, { idActual: reserva._id, revisarPasado: cambioHorario });
      reserva.set(datos);
      reserva.estado = reserva.estado === 'aprobada' && (cambioHorario || cambioSala) && req.body.estado === undefined
        ? 'pendiente'
        : nuevoEstado;
    }

    await reserva.save();
    await reserva.populate(POBLAR);
    res.json(reserva);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/reservas/:id
// Una reserva próxima activa se cancela, no se borra: solo se eliminan las canceladas,
// rechazadas o ya terminadas (limpieza del historial).
async function eliminar(req, res, next) {
  try {
    const reserva = await Reserva.findById(req.params.id);
    if (!reserva) throw new HttpError(404, 'Reserva no encontrada');
    if (!req.esAdmin) throw new HttpError(403, 'Solo el administrador puede borrar reservas del historial');
    if (ESTADOS_ACTIVOS.includes(reserva.estado) && reserva.fin > new Date()) {
      throw new HttpError(409, 'La reserva sigue activa. Cancélala primero y después podrás eliminarla.');
    }
    await reserva.deleteOne();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
