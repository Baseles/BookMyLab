// Sesión del usuario (admin o alumno/docente), protección de páginas por rol, tema claro/oscuro
// y la parte derecha de la barra superior (nombre, cambiar tema, cerrar sesión).

// Dominio del correo institucional. Cámbialo por el de tu escuela.
const DOMINIO_INSTITUCIONAL = 'campus.edu.mx';

const CLAVE_SESION = 'bookmylab.sesion';
const NOMBRES_ROL = { admin: 'Administrador', alumno: 'Alumno', docente: 'Docente' };

function leerAlmacen(almacen) {
  try { return JSON.parse(almacen.getItem(CLAVE_SESION)); } catch { return null; }
}

// La sesión vive en localStorage si marcó "Mantener sesión", si no en sessionStorage (se borra al cerrar el navegador)
function obtenerSesion() {
  return leerAlmacen(sessionStorage) || leerAlmacen(localStorage);
}

function guardarSesion(sesion, recordar) {
  try {
    borrarSesion();
    (recordar ? localStorage : sessionStorage).setItem(CLAVE_SESION, JSON.stringify(sesion));
  } catch { /* almacenamiento bloqueado: la sesión dura solo esta página */ }
}

function borrarSesion() {
  try { sessionStorage.removeItem(CLAVE_SESION); localStorage.removeItem(CLAVE_SESION); } catch { /* nada */ }
}

const esAdmin = (sesion) => sesion?.usuario?.rol === 'admin';

function irALogin(motivo) {
  const destino = location.pathname + location.search;
  const p = new URLSearchParams();
  if (destino && destino !== '/') p.set('volver', destino);
  if (motivo) p.set('motivo', motivo);
  location.replace(`/login${p.toString() ? `?${p}` : ''}`);
}

// Llamar al inicio de cada página protegida. Devuelve la sesión o redirige.
function requerirSesion({ roles } = {}) {
  const sesion = obtenerSesion();
  if (!sesion?.usuario) {
    irALogin();
    return null;
  }
  if (roles && !roles.includes(sesion.usuario.rol)) {
    location.replace('/?motivo=sin-permiso');
    return null;
  }
  aplicarRolEnPagina(sesion);
  return sesion;
}

// Quita lo que el rol no puede ver: elementos con data-roles="admin" y enlaces del menú
function aplicarRolEnPagina(sesion) {
  const rol = sesion.usuario.rol;
  document.querySelectorAll('[data-roles]').forEach((el) => {
    if (!el.dataset.roles.split(',').includes(rol)) el.remove();
  });
  document.body.dataset.rol = rol;
  document.body.dataset.sesion = '';
  pintarUsuarioEnBarra(sesion);
}

async function cerrarSesion() {
  try { await api('/auth/logout', { method: 'POST' }); } catch { /* si falla, igual se cierra localmente */ }
  borrarSesion();
  location.replace('/login?motivo=salio');
}

/* ---------- Tema ---------- */
function temaActual() {
  const elegido = document.documentElement.dataset.theme;
  if (elegido) return elegido;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function cambiarTema() {
  const nuevo = temaActual() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = nuevo;
  try { localStorage.setItem('bookmylab.tema', nuevo); } catch { /* nada */ }
  document.querySelectorAll('[data-cambiar-tema]').forEach(etiquetarBotonTema);
}

function etiquetarBotonTema(boton) {
  boton.setAttribute('aria-label', temaActual() === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
  boton.title = boton.getAttribute('aria-label');
}

const ICONOS_TEMA = `
  <svg class="icono-luna" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>
  <svg class="icono-sol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;

const ICONO_SALIR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>';

function crearBotonTema() {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'btn-icono';
  boton.dataset.cambiarTema = '';
  boton.innerHTML = ICONOS_TEMA;
  etiquetarBotonTema(boton);
  boton.addEventListener('click', cambiarTema);
  return boton;
}

function pintarUsuarioEnBarra(sesion) {
  const barra = document.querySelector('.barra__interior');
  if (!barra || barra.querySelector('.barra__usuario')) return;
  const u = sesion.usuario;
  const zona = document.createElement('div');
  zona.className = 'barra__usuario';
  const primerNombre = u.nombreCompleto.split(' ').slice(0, 1).join(' ');
  const apellido = u.nombreCompleto.split(' ').at(-2) ?? '';
  zona.innerHTML = `
    <div class="chip-usuario"><strong>${escapar(`${primerNombre} ${apellido}`.trim())}</strong><span>${escapar(NOMBRES_ROL[u.rol] ?? u.rol)}${u.noControl ? ` · ${escapar(u.noControl)}` : ''}</span></div>`;
  zona.append(crearBotonTema());
  const salir = document.createElement('button');
  salir.type = 'button';
  salir.className = 'btn-icono btn-icono--salir';
  salir.innerHTML = ICONO_SALIR;
  salir.setAttribute('aria-label', 'Cerrar sesión');
  salir.title = 'Cerrar sesión';
  salir.addEventListener('click', cerrarSesion);
  zona.append(salir);
  barra.append(zona);
}
