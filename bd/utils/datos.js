// Utilidades para limpiar la entrada del cliente.

// Copia solo los campos permitidos. '' y null se vuelven undefined (campo vacío / se borra).
function tomarCampos(body = {}, permitidos) {
  const datos = {};
  for (const campo of permitidos) {
    if (!(campo in body)) continue;
    const valor = body[campo];
    if (valor === '' || valor === null) datos[campo] = undefined;
    else datos[campo] = typeof valor === 'string' ? valor.trim() : valor;
  }
  return datos;
}

// Escapa caracteres especiales para usar texto del usuario dentro de una RegExp.
function escaparRegex(texto) {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const esObjectId = (id) => /^[a-f\d]{24}$/i.test(String(id));

module.exports = { tomarCampos, escaparRegex, esObjectId };
