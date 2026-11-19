// Usuario: alumno o docente que puede hacer reservas, o admin que administra el sistema.
const { Schema, model } = require('mongoose');
const { cifrarClave, esClaveCifrada } = require('../utils/claves');
const { CARRERAS, ROLES, REGEX_NO_CONTROL, REGEX_NO_EMPLEADO } = require('../config/catalogos');

const usuarioSchema = new Schema(
  {
    noControl: {
      type: String,
      required: [true, 'El No. de control es obligatorio'],
      unique: true,
      trim: true,
      uppercase: true,
      validate: {
        // Alumnos: 8 dígitos (23400686). Docentes y admins: No. de empleado de 4 a 13 caracteres.
        validator(valor) {
          return this.rol !== 'alumno' ? REGEX_NO_EMPLEADO.test(valor) : REGEX_NO_CONTROL.test(valor);
        },
        message: 'Formato inválido. Alumnos: 8 dígitos (ej. 23400686). Docentes y admins: 4 a 13 letras o números.',
      },
    },
    nombreCompleto: {
      type: String,
      required: [true, 'El nombre completo es obligatorio'],
      trim: true,
      maxlength: [80, 'Máximo 80 caracteres'],
      match: [/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'. -]+$/, 'Solo letras y espacios'],
      validate: {
        validator: (v) => v.trim().split(/\s+/).length >= 2,
        message: 'Escribe nombre y al menos un apellido',
      },
    },
    rol: {
      type: String,
      enum: { values: ROLES, message: 'Rol no válido' },
      default: 'alumno',
    },
    carrera: {
      type: String,
      enum: { values: CARRERAS, message: 'Selecciona una carrera de la lista' },
      required: [function () { return this.rol === 'alumno'; }, 'La carrera es obligatoria para alumnos'],
    },
    semestre: {
      type: Number,
      min: [1, 'El semestre va de 1 a 14'],
      max: [14, 'El semestre va de 1 a 14'],
      validate: { validator: Number.isInteger, message: 'El semestre debe ser un número entero' },
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Correo electrónico inválido'],
      unique: true,
      sparse: true, // el correo es el usuario del login: no se repite
    },
    // Contraseña cifrada con scrypt. No se devuelve en las consultas (select: false).
    password: {
      type: String,
      select: false,
      required: [function () { return this.isNew; }, 'Asigna una contraseña inicial'],
      validate: {
        validator: (v) => esClaveCifrada(v) || (v.length >= 8 && v.length <= 72),
        message: 'La contraseña debe tener de 8 a 72 caracteres',
      },
    },
    activo: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { transform: (doc, ret) => { delete ret.password; return ret; } },
  }
);

usuarioSchema.index({ nombreCompleto: 1 });

// Se cifra justo antes de guardar (las validaciones ya revisaron el largo de la contraseña en claro)
usuarioSchema.pre('save', function () {
  if (this.isModified('password') && this.password && !esClaveCifrada(this.password)) {
    this.password = cifrarClave(this.password);
  }
});

module.exports = model('Usuario', usuarioSchema);
