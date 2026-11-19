// Cliente de la API de BookMyLab. Todas las peticiones envían y reciben JSON.
// Si hay sesión, se manda el token en el encabezado Authorization.
const API_URL = '/api';

async function api(ruta, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = typeof obtenerSesion === 'function' ? obtenerSesion()?.token : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(API_URL + ruta, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    const err = new Error('No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.');
    err.status = 0;
    throw err;
  }

  const texto = await res.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch { /* respuesta no JSON */ }

  // Sesión vencida o inválida: se borra y se manda al login (excepto en el propio login)
  if (res.status === 401 && !ruta.startsWith('/auth/login') && typeof irALogin === 'function') {
    borrarSesion();
    irALogin('expirada');
  }

  if (!res.ok) {
    const err = new Error(datos?.mensaje || `Error ${res.status}`);
    err.status = res.status;
    err.campos = datos?.campos || {};
    throw err;
  }
  return datos;
}

// Los catálogos (carreras, tipos, estados) se piden una sola vez por página
let catalogosPromesa;
function catalogos() {
  catalogosPromesa ??= api('/catalogos');
  return catalogosPromesa;
}
