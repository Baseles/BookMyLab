// Protección de la API: `autenticar` exige un token válido (Authorization: Bearer <token>)
// y deja el usuario en req.usuario. `soloAdmin` limita una ruta al rol admin.
const Sesion = require('../modelos/sesion.modelo');
const HttpError = require('../utils/HttpError');
const { hashToken } = require('../utils/claves');

async function autenticar(req, res, next) {
  try {
    const [tipo, token] = (req.get('Authorization') || '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new HttpError(401, 'Inicia sesión para continuar');

    const sesion = await Sesion.findOne({ tokenHash: hashToken(token), expira: { $gt: new Date() } })
      .populate('usuario', 'noControl nombreCompleto rol carrera email activo')
      .lean();
    if (!sesion?.usuario) throw new HttpError(401, 'Tu sesión expiró. Vuelve a iniciar sesión.');
    if (!sesion.usuario.activo) {
      await Sesion.deleteOne({ _id: sesion._id });
      throw new HttpError(401, 'Tu cuenta está desactivada');
    }

    req.usuario = sesion.usuario;
    req.sesionId = sesion._id;
    req.esAdmin = sesion.usuario.rol === 'admin';
    next();
  } catch (err) {
    next(err);
  }
}

function soloAdmin(req, res, next) {
  if (!req.esAdmin) return next(new HttpError(403, 'Solo el administrador puede hacer esto'));
  next();
}

// Para rutas donde todos leen pero solo el admin escribe
function adminParaEscribir(req, res, next) {
  if (req.method === 'GET') return next();
  soloAdmin(req, res, next);
}

module.exports = { autenticar, soloAdmin, adminParaEscribir };
