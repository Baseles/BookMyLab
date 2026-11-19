// Sala: laboratorio, aula o espacio que se puede reservar, con su horario de servicio.
const { Schema, model } = require('mongoose');
const { TIPOS_SALA, REGEX_HORA } = require('../config/catalogos');

const salaSchema = new Schema(
  {
    clave: {
      type: String,
      required: [true, 'La clave es obligatoria'],
      unique: true,
      trim: true,
      uppercase: true,
      match: [/^[A-Z0-9-]{2,12}$/, 'De 2 a 12 letras, números o guiones (ej. LC-01)'],
    },
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
      minlength: [3, 'Mínimo 3 caracteres'],
      maxlength: [60, 'Máximo 60 caracteres'],
    },
    tipo: {
      type: String,
      required: [true, 'El tipo es obligatorio'],
      enum: { values: TIPOS_SALA, message: 'Tipo de sala no válido' },
    },
    edificio: {
      type: String,
      required: [true, 'El edificio es obligatorio'],
      trim: true,
      uppercase: true,
      maxlength: [20, 'Máximo 20 caracteres'],
    },
    capacidad: {
      type: Number,
      required: [true, 'La capacidad es obligatoria'],
      min: [1, 'Debe ser al menos 1 persona'],
      max: [500, 'Máximo 500 personas'],
      validate: { validator: Number.isInteger, message: 'Debe ser un número entero' },
    },
    horaApertura: {
      type: String,
      required: [true, 'La hora de apertura es obligatoria'],
      match: [REGEX_HORA, 'Hora inválida (HH:MM)'],
      default: '07:00',
    },
    horaCierre: {
      type: String,
      required: [true, 'La hora de cierre es obligatoria'],
      match: [REGEX_HORA, 'Hora inválida (HH:MM)'],
      default: '21:00',
      validate: {
        validator(valor) { return !this.horaApertura || valor > this.horaApertura; },
        message: 'El cierre debe ser después de la apertura',
      },
    },
    disponible: { type: Boolean, default: true },
    descripcion: { type: String, trim: true, maxlength: [200, 'Máximo 200 caracteres'] },
  },
  { timestamps: true, versionKey: false }
);

module.exports = model('Sala', salaSchema);
