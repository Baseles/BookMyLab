// Controlador genérico para las pantallas de CRUD: formulario (crear/editar) + filtros + tabla.
// Cada pantalla le pasa cómo pintar una fila y cómo rellenar el formulario.
function crearCrud({
  recurso,            // 'salas', 'equipos', ...
  textos,             // { nuevo, editar, creado, actualizado, eliminado }
  columnas,           // número de columnas de la tabla
  fila,               // (item) => '<tr>...</tr>'
  rellenar,           // (form, item) => void
  describir,          // (item) => 'la sala LC-01'
  prepararDatos,      // (datos, { editando }) => datos   (opcional)
  alGuardar,          // (respuesta, { editando }) => void (opcional)
  alCambiarModo,      // (modo, item) => void              (opcional)
  acciones = {},      // { nombreAccion: async (item, recargar) => void }
  formAbierto = false, // en celular el formulario empieza plegado; true lo abre desde el inicio
}) {
  const form = $('#form');
  const filtros = $('#filtros');
  const tbody = $('#tabla');
  // Sin formulario (por ejemplo, un alumno viendo el catálogo) la pantalla es de solo lectura
  const titulo = form && $('[data-titulo]', form);
  const cabecera = form && $('.form-titulo', form);
  const btnGuardar = form && $('[type="submit"]', form);
  const btnCancelar = form && $('[data-cancelar]', form);
  const contador = $('[data-contador]');
  let items = [];
  let editandoId = null;

  // En pantallas angostas el formulario se pliega a solo su título para que la tabla se vea primero
  const panelForm = form?.closest('.panel--form');
  let btnPlegar = null;
  function plegarForm(plegado) {
    if (!btnPlegar) return;
    panelForm.toggleAttribute('data-plegado', plegado);
    btnPlegar.setAttribute('aria-expanded', String(!plegado));
    const texto = plegado ? `Mostrar formulario: ${titulo.textContent}` : 'Ocultar formulario';
    btnPlegar.setAttribute('aria-label', texto);
    btnPlegar.title = texto;
  }
  if (panelForm && cabecera) {
    btnPlegar = document.createElement('button');
    btnPlegar.type = 'button';
    btnPlegar.className = 'btn-icono btn-icono--sm form-plegar';
    btnPlegar.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
    btnPlegar.addEventListener('click', () => plegarForm(!panelForm.hasAttribute('data-plegado')));
    cabecera.append(btnPlegar);
    plegarForm(!formAbierto);
  }

  function parametrosFiltro() {
    if (!filtros) return '';
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(datosFormulario(filtros))) {
      if (v === true) p.set(k, 'true');
      else if (v !== '' && v !== false && v != null) p.set(k, v);
    }
    const texto = p.toString();
    return texto ? `?${texto}` : '';
  }

  async function cargar() {
    tbody.setAttribute('aria-busy', 'true');
    if (!items.length) tbody.innerHTML = filasEsqueleto(columnas);
    try {
      items = await api(`/${recurso}${parametrosFiltro()}`);
      pintar();
    } catch (err) {
      items = [];
      tbody.innerHTML = filaMensaje(columnas, `No se pudieron cargar los datos: ${err.message}`, 'error');
      if (contador) contador.textContent = '';
    } finally {
      tbody.removeAttribute('aria-busy');
    }
  }

  function pintar() {
    tbody.innerHTML = items.length
      ? items.map(fila).join('')
      : filaMensaje(columnas, filtros && parametrosFiltro() ? 'Ningún registro coincide con los filtros.' : 'Todavía no hay registros. Usa el formulario para agregar el primero.');
    if (editandoId) tbody.querySelector(`[data-id="${editandoId}"]`)?.classList.add('editando');
    if (contador) contador.textContent = `${items.length} ${items.length === 1 ? 'registro' : 'registros'}`;
  }

  function modoCrear() {
    editandoId = null;
    if (!form) return;
    form.reset();
    limpiarErrores(form);
    titulo.textContent = textos.nuevo;
    cabecera?.removeAttribute('data-modo');
    btnCancelar.hidden = true;
    $$('tr.editando', tbody).forEach((tr) => tr.classList.remove('editando'));
    alCambiarModo?.('crear');
  }

  function modoEditar(item) {
    if (!form) return;
    modoCrear();
    editandoId = item._id;
    rellenar(form, item);
    titulo.textContent = textos.editar;
    cabecera?.setAttribute('data-modo', 'editar');
    plegarForm(false);
    btnCancelar.hidden = false;
    tbody.querySelector(`[data-id="${item._id}"]`)?.classList.add('editando');
    alCambiarModo?.('editar', item);
    form.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    form.querySelector('input:not([type="hidden"]), select, textarea')?.focus({ preventScroll: true });
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErrores(form);
    if (!validarLocal(form)) {
      toast('Revisa los campos marcados en rojo', 'error');
      return;
    }
    const editando = Boolean(editandoId);
    let datos = datosFormulario(form);
    if (prepararDatos) datos = prepararDatos(datos, { editando });

    await conCarga(btnGuardar, 'Guardando…', async () => {
      try {
        const respuesta = await api(editando ? `/${recurso}/${editandoId}` : `/${recurso}`, {
          method: editando ? 'PUT' : 'POST',
          body: datos,
        });
        toast(editando ? textos.actualizado : textos.creado);
        alGuardar?.(respuesta, { editando });
        modoCrear();
        plegarForm(true);
        await cargar();
      } catch (err) {
        mostrarErrores(form, err.campos);
        toast(err.message, 'error');
      }
    });
  });

  btnCancelar?.addEventListener('click', () => { modoCrear(); plegarForm(true); });

  tbody.addEventListener('click', async (e) => {
    const boton = e.target.closest('[data-accion]');
    if (!boton) return;
    const item = items.find((i) => i._id === boton.closest('[data-id]')?.dataset.id);
    if (!item) return;
    const accion = boton.dataset.accion;

    if (accion === 'editar') return modoEditar(item);

    if (accion === 'eliminar') {
      const ok = await confirmar(`Se eliminará ${describir(item)}. Esta acción no se puede deshacer.`, { titulo: '¿Eliminar registro?' });
      if (!ok) return;
      try {
        await api(`/${recurso}/${item._id}`, { method: 'DELETE' });
        toast(textos.eliminado);
        if (editandoId === item._id) modoCrear();
        await cargar();
      } catch (err) {
        toast(err.message, 'error');
      }
      return;
    }

    if (acciones[accion]) {
      boton.disabled = true;
      try { await acciones[accion](item, cargar); } finally { boton.disabled = false; }
    }
  });

  if (filtros) {
    const recargar = debounce(cargar, 300);
    filtros.addEventListener('input', recargar);
    filtros.addEventListener('change', recargar);
    filtros.addEventListener('submit', (e) => e.preventDefault());
    filtros.addEventListener('reset', () => setTimeout(cargar));
  }

  return { cargar, modoCrear, modoEditar, items: () => items };
}

// Iconos de las acciones de fila (lápiz y bote de basura)
const ICONOS_FILA = {
  editar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  eliminar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
};

// Botones de acción estándar para una fila
function botonesFila(...botones) {
  const html = {
    editar: `<button type="button" class="btn-icono btn-icono--sm btn-icono--editar" data-accion="editar" aria-label="Editar" title="Editar">${ICONOS_FILA.editar}</button>`,
    eliminar: `<button type="button" class="btn-icono btn-icono--sm btn-icono--peligro" data-accion="eliminar" aria-label="Eliminar" title="Eliminar">${ICONOS_FILA.eliminar}</button>`,
  };
  return `<td class="acciones-celda"><div class="acciones">${botones.map((b) => html[b] ?? b).join('')}</div></td>`;
}
