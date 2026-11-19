// Utilidades de interfaz compartidas: avisos, confirmación, formularios, formato de fechas.

const $ = (selector, contexto = document) => contexto.querySelector(selector);
const $$ = (selector, contexto = document) => [...contexto.querySelectorAll(selector)];

function escapar(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Avisos ---------- */
function toast(mensaje, tipo = 'exito') {
  let contenedor = $('#toasts');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'toasts';
    contenedor.className = 'toasts';
    contenedor.setAttribute('aria-live', 'polite');
    document.body.append(contenedor);
  }
  const iconos = { exito: '✓', error: '!', aviso: 'i' };
  const el = document.createElement('div');
  el.className = `toast toast--${tipo}`;
  el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  el.innerHTML = `<span class="toast__icono" aria-hidden="true">${iconos[tipo] || 'i'}</span><span>${escapar(mensaje)}</span><button class="toast__cerrar" type="button" aria-label="Cerrar aviso">×</button>`;
  const quitar = () => {
    el.classList.add('saliendo');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400);
  };
  el.querySelector('button').addEventListener('click', quitar);
  contenedor.append(el);
  setTimeout(quitar, tipo === 'error' ? 7000 : 4000);
}

/* ---------- Confirmación (sin alert/confirm del navegador) ---------- */
function confirmar(mensaje, { titulo = '¿Estás seguro?', textoOk = 'Eliminar', peligro = true } = {}) {
  return new Promise((resolver) => {
    const dialogo = document.createElement('dialog');
    dialogo.className = 'dialogo';
    dialogo.innerHTML = `
      <h2>${escapar(titulo)}</h2>
      <p>${escapar(mensaje)}</p>
      <div class="form__acciones">
        <button type="button" class="btn btn--fantasma" value="no">Volver</button>
        <button type="button" class="btn ${peligro ? 'btn--peligro-lleno' : 'btn--primario'}" value="si">${escapar(textoOk)}</button>
      </div>`;
    document.body.append(dialogo);
    dialogo.addEventListener('click', (e) => {
      const boton = e.target.closest('button');
      if (boton) dialogo.close(boton.value);
      else if (e.target === dialogo) dialogo.close('no'); // clic en el fondo
    });
    dialogo.addEventListener('close', () => {
      resolver(dialogo.returnValue === 'si');
      dialogo.remove();
    });
    dialogo.showModal();
    dialogo.querySelector('[value="no"]').focus();
  });
}

/* ---------- Formularios ---------- */
function limpiarErrores(form) {
  $$('[data-error-for]', form).forEach((el) => { el.textContent = ''; });
  $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
}

function marcarError(form, campo, mensaje) {
  const caja = $(`[data-error-for="${campo}"]`, form);
  if (!caja) return false;
  caja.textContent = mensaje;
  const control = form.elements[campo];
  const elemento = control instanceof RadioNodeList ? control[0] : control;
  elemento?.setAttribute?.('aria-invalid', 'true');
  return true;
}

// Muestra los errores por campo que devuelve la API. Devuelve true si marcó alguno.
function mostrarErrores(form, campos = {}) {
  let primero = null;
  for (const [campo, mensaje] of Object.entries(campos)) {
    if (marcarError(form, campo, mensaje) && !primero) primero = form.elements[campo];
  }
  (primero instanceof RadioNodeList ? primero[0] : primero)?.focus?.();
  return Boolean(primero);
}

// Validación en el navegador (required, pattern, min, max...) antes de llamar a la API
function validarLocal(form) {
  let valido = true;
  let primero = null;
  for (const el of form.elements) {
    if (!el.name || !el.willValidate || el.validity.valid) continue;
    valido = false;
    primero ??= el;
    marcarError(form, el.name, el.dataset.msg && !el.validity.valueMissing ? el.dataset.msg : el.validationMessage);
  }
  primero?.focus();
  return valido;
}

// Convierte el formulario en un objeto. Checkboxes con data-lista se vuelven arreglo; los sueltos, booleano.
function datosFormulario(form) {
  const datos = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled || el.type === 'submit' || el.type === 'button') continue;
    if (el.type === 'radio') {
      if (el.checked) datos[el.name] = el.value;
    } else if (el.type === 'checkbox') {
      if (el.dataset.lista !== undefined) {
        datos[el.name] ??= [];
        if (el.checked) datos[el.name].push(el.value);
      } else {
        datos[el.name] = el.checked;
      }
    } else if (el.type === 'number') {
      datos[el.name] = el.value === '' ? '' : Number(el.value);
    } else {
      datos[el.name] = el.value.trim();
    }
  }
  return datos;
}

async function conCarga(boton, texto, tarea) {
  const original = boton.textContent;
  boton.disabled = true;
  boton.textContent = texto;
  try {
    return await tarea();
  } finally {
    boton.disabled = false;
    boton.textContent = original;
  }
}

function llenarSelect(select, opciones, { vacio } = {}) {
  const actual = select.value;
  select.innerHTML = (vacio !== undefined ? `<option value="">${escapar(vacio)}</option>` : '')
    + opciones.map((o) => {
      const [valor, texto] = typeof o === 'string' ? [o, capitalizar(o)] : [o.valor, o.texto];
      return `<option value="${escapar(valor)}">${escapar(texto)}</option>`;
    }).join('');
  if ([...select.options].some((o) => o.value === actual)) select.value = actual;
}

const capitalizar = (t) => t.charAt(0).toUpperCase() + t.slice(1);

function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ---------- Fechas ---------- */
const dos = (n) => String(n).padStart(2, '0');
const fechaISO = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
const horaLocal = (d) => `${dos(d.getHours())}:${dos(d.getMinutes())}`;
const formatoDia = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
const formatoDiaLargo = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

function describirDia(fecha) {
  const d = new Date(fecha);
  const hoy = new Date();
  const manana = new Date(); manana.setDate(hoy.getDate() + 1);
  if (fechaISO(d) === fechaISO(hoy)) return 'Hoy';
  if (fechaISO(d) === fechaISO(manana)) return 'Mañana';
  return capitalizar(formatoDia.format(d));
}

/* ---------- Etiquetas de estado ---------- */
const CLASES_ESTADO = {
  aprobada: 'ok', bueno: 'ok', disponible: 'ok', activo: 'ok',
  pendiente: 'pendiente', 'en reparación': 'pendiente',
  rechazada: 'mal', cancelada: 'mal', dañado: 'mal', 'no disponible': 'mal', inactivo: 'mal',
  terminada: '', docente: 'info', alumno: '', admin: 'pendiente',
};
function badge(texto) {
  const clase = CLASES_ESTADO[texto];
  return `<span class="badge${clase ? ` badge--${clase}` : ''}">${escapar(capitalizar(texto))}</span>`;
}

/* ---------- Esqueletos de carga (skeleton) ---------- */
const ANCHOS_ESQUELETO = ['largo', 'medio', 'corto', 'medio', 'largo', 'corto'];
const lineaEsqueleto = (ancho = 'medio', extra = '') => `<span class="esqueleto esqueleto--${ancho}${extra}"></span>`;
const AVISO_CARGA = '<span class="sr-only">Cargando…</span>';

// Filas grises que imitan la tabla mientras llegan los datos. La última columna son las acciones.
function filasEsqueleto(columnas, cantidad = 5) {
  return Array.from({ length: cantidad }, (_, f) => {
    const celdas = Array.from({ length: columnas }, (_, c) => {
      if (c === columnas - 1) return `<td class="acciones-celda"><div class="acciones">${lineaEsqueleto('icono')}${lineaEsqueleto('icono')}</div></td>`;
      const sub = c < 2 ? lineaEsqueleto('corto', ' esqueleto--sub') : '';
      return `<td>${f === 0 && c === 0 ? AVISO_CARGA : ''}${lineaEsqueleto(ANCHOS_ESQUELETO[(f + c) % ANCHOS_ESQUELETO.length])}${sub}</td>`;
    }).join('');
    return `<tr class="fila-esqueleto">${celdas}</tr>`;
  }).join('');
}

// Elementos de .lista-reservas (bloque de fecha + dos líneas + etiqueta)
function listaEsqueleto(cantidad = 3) {
  return Array.from({ length: cantidad }, (_, i) => `
    <li class="item-esqueleto">${i === 0 ? AVISO_CARGA : ''}
      <span class="esqueleto esqueleto--fecha"></span>
      <div>${lineaEsqueleto(i % 2 ? 'medio' : 'largo')}${lineaEsqueleto('corto', ' esqueleto--sub')}</div>
      <span class="esqueleto esqueleto--badge"></span>
    </li>`).join('');
}

function filaMensaje(columnas, mensaje, tipo = '') {
  return `<tr class="fila-mensaje ${tipo}"><td colspan="${columnas}">${escapar(mensaje)}</td></tr>`;
}
