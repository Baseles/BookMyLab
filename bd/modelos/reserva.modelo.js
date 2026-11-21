// Modelo Reserva: un usuario aparta una sala (y si quiere, equipo) en un horario.
const mongoose = require('mongoose');
const { ESTADOS_RESERVA } = require('../config/catalogos');

const reservaSchema = new mongoose.Schema(
  {
    // Tres relaciones: quién reserva, qué sala y qué equipos
    usuario: { type: mongoose.ObjectId, ref: 'Usuario', required: [true, 'Indica quién reserva'] },
    sala: { type: mongoose.ObjectId, ref: 'Sala', required: [true, 'Selecciona una sala'] },
    equipos: [{ type: mongoose.ObjectId, ref: 'Equipo' }], // [ ] = una lista de equipos
    inicio: { type: Date, required: [true, 'La fecha y hora de inicio son obligatorias'] },
    fin: {
      type: Date,
      required: [true, 'La hora de fin es obligatoria'],
      // Validación propia: el fin tiene que ser después del inicio
      validate: {
        validator: function (valor) {
          return valor > this.inicio;
        },
        message: 'La hora de fin debe ser después del inicio',
      },
    },
    asistentes: {
      type: Number,
      required: [true, 'Indica cuántas personas asistirán'],
      min: [1, 'Al menos 1 persona'],
    },
    motivo: {
      type: String,
      required: [true, 'El motivo es obligatorio'],
      trim: true,
      minlength: [5, 'Describe el motivo (mínimo 5 caracteres)'],
      maxlength: [200, 'Máximo 200 caracteres'],
    },
    estado: {
      type: String,
      enum: { values: ESTADOS_RESERVA, message: 'Estado no válido' },
      default: 'pendiente', // toda reserva nueva empieza pendiente
    },
  },
  { timestamps: true }
);

const Reserva = mongoose.model('Reserva', reservaSchema, 'reservas');

module.exports = Reserva;