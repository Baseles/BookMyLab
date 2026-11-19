// Error con código HTTP. `campos` permite señalar qué input del formulario está mal.
class HttpError extends Error {
  constructor(status, mensaje, campos) {
    super(mensaje);
    this.status = status;
    if (campos) this.campos = campos;
  }
}

module.exports = HttpError;
