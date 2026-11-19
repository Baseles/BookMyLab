// Inicio y cierre de sesión con correo institucional y contraseña.
const Usuario = require('../modelos/usuario.modelo');
const Sesion = require('../modelos/sesion.modelo');
const HttpError = require('../utils/HttpError');
const { verificarClave, generarToken, hashToken, CLAVE_FALSA } = require('../utils/claves');

const DURACION_NORMAL = 12 * 3600 * 1000;      // 12 horas
const DURACION_RECORDAR = 30 * 24 * 3600 * 1000; // 30 días con "Mantener sesión"

// Freno contra adivinar contraseñas: 5 intentos fallidos por correo + IP cada 15 minutos
const VENTANA_MS = 15 * 60 * 1000;
const MAX_FALLOS = 5;
const fallos = new Map();

function intentosDe(clave) {
  const registro = fallos.get(clave);
  if (!registro || registro.desde + VENTANA_MS < Date.now()) return { cuenta: 0, desde: Date.now() };
  return registro;
}

const publico = (u) => ({
  _id: u._id, noControl: u.noControl, nombreCompleto: u.nombreCompleto, rol: u.rol, carrera: u.carrera, email: u.email,
});

// POST /api/auth/login  { email, password, recordar }
async function login(req, res, next) {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const campos = {};
    if (!email) campos.email = 'Escribe tu correo institucional';
    if (!password) campos.password = 'Escribe tu contraseña';
    if (Object.keys(campos).length) throw new HttpError(400, 'Revisa los datos marcados', campos);

    const claveLimite = `${req.ip}|${email}`;
    const intentos = intentosDe(claveLimite);
    if (intentos.cuenta >= MAX_FALLOS) {
      const minutos = Math.ceil((intentos.desde + VENTANA_MS - Date.now()) / 60000);
      throw new HttpError(429, `Demasiados intentos fallidos. Espera ${minutos} min e inténtalo de nuevo.`);
    }

    const usuario = await Usuario.findOne({ email }).select('+password').lean();
    const correcta = verificarClave(password, usuario?.password || CLAVE_FALSA) && Boolean(usuario?.password);
    if (!correcta) {
      fallos.set(claveLimite, { cuenta: intentos.cuenta + 1, desde: intentos.desde });
      throw new HttpError(401, 'Correo o contraseña incorrectos.');
    }
    fallos.delete(claveLimite);
    if (!usuario.activo) throw new HttpError(403, 'Tu cuenta está desactivada. Acude al Centro de Cómputo.');

    const token = generarToken();
    const expira = new Date(Date.now() + (req.body.recordar ? DURACION_RECORDAR : DURACION_NORMAL));
    await Sesion.create({ usuario: usuario._id, tokenHash: hashToken(token), expira });

    res.json({ token, expira, usuario: publico(usuario) });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/logout
async function logout(req, res, next) {
  try {
    await Sesion.deleteOne({ _id: req.sesionId });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/yo
function yo(req, res) {
  res.json(publico(req.usuario));
}

module.exports = { login, logout, yo };
