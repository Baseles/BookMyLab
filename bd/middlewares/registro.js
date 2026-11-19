// Registra en consola cada petición a la API: método, ruta, código y tiempo de respuesta.
function registro(req, res, next) {
  const inicio = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - inicio} ms)`);
  });
  next();
}

module.exports = registro;
