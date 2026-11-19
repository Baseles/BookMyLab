// Sesión iniciada: se crea en el login y se borra en el logout.
// MongoDB elimina solas las sesiones vencidas gracias al índice TTL sobre `expira`.
const { Schema, model } = require('mongoose');

const sesionSchema = new Schema(
  {
    usuario: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expira: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

sesionSchema.index({ expira: 1 }, { expireAfterSeconds: 0 });

module.exports = model('Sesion', sesionSchema, 'sesiones');
