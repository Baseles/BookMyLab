// Contraseñas y tokens de sesión con el módulo crypto de Node (sin dependencias extra).
//  - Contraseña: scrypt con sal aleatoria. Se guarda como "scrypt$<sal>$<hash>" (hex).
//  - Token: 32 bytes aleatorios. En la BD solo se guarda su SHA-256, nunca el token en claro.
const crypto = require('crypto');

const LARGO_HASH = 64;

function cifrarClave(clave) {
  const sal = crypto.randomBytes(16);
  const hash = crypto.scryptSync(clave, sal, LARGO_HASH);
  return `scrypt$${sal.toString('hex')}$${hash.toString('hex')}`;
}

function verificarClave(clave, guardada) {
  const [algoritmo, salHex, hashHex] = String(guardada || '').split('$');
  if (algoritmo !== 'scrypt' || !salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  const calculado = crypto.scryptSync(String(clave), Buffer.from(salHex, 'hex'), esperado.length);
  return crypto.timingSafeEqual(esperado, calculado);
}

const esClaveCifrada = (valor) => /^scrypt\$[a-f\d]+\$[a-f\d]+$/.test(String(valor));

const generarToken = () => crypto.randomBytes(32).toString('base64url');
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

// Hash de una contraseña falsa para gastar el mismo tiempo cuando el correo no existe
const CLAVE_FALSA = cifrarClave(crypto.randomBytes(12).toString('hex'));

module.exports = { cifrarClave, verificarClave, esClaveCifrada, generarToken, hashToken, CLAVE_FALSA };
