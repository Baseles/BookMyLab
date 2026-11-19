// Reserva: un usuario aparta una sala (y opcionalmente equipo) en un horario.
const { Schema, model } = require('mongoose');
const { ESTADOS_RESERVA } = require('../config/catalogos');

const reservaSchema = new Schema(
  {
    usuario: { type: Schema.Types.ObjectId, ref: 'Usuario', required: [true, 'Indica quién reserva'] },
    sala: { type: Schema.Types.ObjectId, ref: 'Sala', required: [true, 'Selecciona una sala'] },
    equipos: [{ type: Schema.Types.ObjectId, ref: 'Equipo' }],
    inicio: { type: Date, required: [true, 'La fecha y hora de inicio son obligatorias'] },
    fin: {
      type: Date,
      required: [true, 'La hora de fin es obligatoria'],
      validate: {
        validator(valor) { return !this.inicio || valor > this.inicio; },
        message: 'La hora de fin debe ser después del inicio',
      },
    },
    asistentes: {
      type: Number,
      required: [true, 'Indica cuántas personas asistirán'],
      min: [1, 'Al menos 1 persona'],
      validate: { validator: Number.isInteger, message: 'Debe ser un número entero' },
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
      default: 'pendiente',
    },
  },
  { timestamps: true, versionKey: false }
);

// Índices para las búsquedas de choques de horario
reservaSchema.index({ sala: 1, inicio: 1 });
reservaSchema.index({ usuario: 1, inicio: 1 });
reservaSchema.index({ equipos: 1, inicio: 1 });

module.exports = model('Reserva', reservaSchema);
