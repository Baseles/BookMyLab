// Equipo: material que se presta junto con una reserva (proyector, laptop, microscopio...).
const { Schema, model } = require('mongoose');
const { TIPOS_EQUIPO, ESTADOS_EQUIPO } = require('../config/catalogos');

const equipoSchema = new Schema(
  {
    noInventario: {
      type: String,
      required: [true, 'El No. de inventario es obligatorio'],
      unique: true,
      trim: true,
      uppercase: true,
      match: [/^[A-Z0-9-]{3,20}$/, 'De 3 a 20 letras, números o guiones (ej. PRY-0012)'],
    },
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
      minlength: [2, 'Mínimo 2 caracteres'],
      maxlength: [60, 'Máximo 60 caracteres'],
    },
    tipo: {
      type: String,
      required: [true, 'El tipo es obligatorio'],
      enum: { values: TIPOS_EQUIPO, message: 'Tipo de equipo no válido' },
    },
    estado: {
      type: String,
      enum: { values: ESTADOS_EQUIPO, message: 'Estado no válido' },
      default: 'bueno',
    },
    // Sala donde se guarda el equipo
    sala: {
      type: Schema.Types.ObjectId,
      ref: 'Sala',
      required: [true, 'Indica en qué sala se guarda'],
    },
    notas: { type: String, trim: true, maxlength: [200, 'Máximo 200 caracteres'] },
  },
  { timestamps: true, versionKey: false }
);

module.exports = model('Equipo', equipoSchema);
