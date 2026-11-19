// Verifica que el parámetro :id sea un ObjectId de MongoDB antes de llegar al controlador.
const { esObjectId } = require('../utils/datos');

function validarId(req, res, next, id) {
  if (!esObjectId(id)) {
    return res.status(400).json({ mensaje: `El id "${id}" no es válido` });
  }
  next();
}

module.exports = validarId;
