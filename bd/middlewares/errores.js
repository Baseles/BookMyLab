// Middlewares de error: 404 para rutas inexistentes y un manejador central que
// traduce los errores de Mongoose/Express a respuestas JSON con el código HTTP correcto.
const mongoose = require('mongoose');

const ETIQUETAS = {
  noControl: 'No. de control',
  clave: 'clave',
  noInventario: 'No. de inventario',
  email: 'correo',
};

function noEncontrado(req, res) {
  res.status(404).json({ mensaje: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function manejadorErrores(err, req, res, next) {
  // Validaciones del esquema -> 400 con el detalle por campo
  if (err instanceof mongoose.Error.ValidationError) {
    const campos = {};
    for (const [campo, detalle] of Object.entries(err.errors)) {
      campos[campo] = detalle.name === 'CastError' ? 'Formato inválido' : detalle.message;
    }
    return res.status(400).json({ mensaje: 'Revisa los datos marcados', campos });
  }

  // Id u otro valor con formato inválido -> 400
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ mensaje: `Valor inválido para ${err.path}`, campos: { [err.path]: 'Formato inválido' } });
  }

  // Índice único duplicado -> 409 Conflict
  if (err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0] || 'campo';
    return res.status(409).json({
      mensaje: `Ya existe un registro con ese ${ETIQUETAS[campo] || campo}`,
      campos: { [campo]: 'Ya está registrado' },
    });
  }

  // JSON mal formado en el body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ mensaje: 'El cuerpo de la petición no es JSON válido' });
  }

  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    mensaje: status >= 500 ? 'Error interno del servidor' : err.message,
    ...(err.campos && { campos: err.campos }),
  });
}

module.exports = { noEncontrado, manejadorErrores };
