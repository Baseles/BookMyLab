// Pantalla de reservas: agenda con filtros, formulario con disponibilidad de la sala y
// acciones de aprobar / cancelar / rechazar.
(async function () {
  const sesion = requerirSesion();
  if (!sesion) return;
  const admin = esAdmin(sesion);

  const form = $('#form');
  const params = new URLSearchParams(location.search);
  const panelDisp = $('#disponibilidad');
  let salas = [];
  let equipos = [];
  let cat = { ESTADOS_RESERVA: [] };
  let reservaEditando = null;

  try {
    let usuarios = [];
    [cat, salas, equipos, usuarios] = await Promise.all([
      catalogos(),
      api('/salas?disponible=true'),
      api('/equipos?estado=bueno&orden=nombre'),
      admin ? api('/usuarios?activo=true&orden=noControl') : [], // un alumno solo reserva a su nombre
    ]);
    if (admin) {
      usuarios = usuarios.filter((u) => u.rol !== 'admin'); // el admin no reserva a su nombre
      llenarSelect($('#usuario'), usuarios.map((u) => ({ valor: u._id, texto: `${u.noControl} · ${u.nombreCompleto}` })),
        { vacio: usuarios.length ? 'Selecciona…' : 'Primero registra un usuario' });
    }
  } catch (err) {
    toast(err.message, 'error');
  }

  const opcionesSala = salas.map((s) => ({ valor: s._id, texto: `${s.clave} · ${s.nombre} (${s.capacidad})` }));
  llenarSelect($('#sala'), opcionesSala, { vacio: salas.length ? 'Selecciona…' : 'No hay salas disponibles' });
  llenarSelect($('#f-sala'), salas.map((s) => ({ valor: s._id, texto: `${s.clave} · ${s.nombre}` })), { vacio: 'Todas' });
  llenarSelect($('#f-estado'), cat.ESTADOS_RESERVA, { vacio: 'Todos' });
  if (admin) llenarSelect($('#estado'), cat.ESTADOS_RESERVA);
  if (!admin) $('#t-lista').textContent = 'Mis reservas';
  $('#fecha').min = fechaISO(new Date());

  // Filtros que llegan desde otras pantallas (?sala=, ?noControl=, ?estado=, ?fecha=)
  for (const nombre of ['noControl', 'fecha', 'estado', 'periodo']) {
    const campo = $('#filtros').elements[nombre];
    if (params.has(nombre) && campo) campo.value = params.get(nombre);
  }
  if (params.get('sala')) {
    $('#f-sala').value = params.get('sala');
    $('#sala').value = params.get('sala');
  }

  /* ---------- Lista de equipo ---------- */
  function pintarEquipos(seleccionados = []) {
    const contenedor = $('#lista-equipos');
    // Al editar, se muestra también el equipo ya apartado aunque no esté en la lista de "bueno"
    const extra = seleccionados.filter((e) => typeof e === 'object' && !equipos.some((x) => x._id === e._id));
    const todos = [...equipos, ...extra];
    const ids = seleccionados.map((e) => (typeof e === 'object' ? e._id : e));
    const salaId = form.elements.sala.value;
    todos.sort((a, b) => Number(b.sala?._id === salaId) - Number(a.sala?._id === salaId));

    contenedor.innerHTML = todos.length
      ? todos.map((e) => `
        <label class="check">
          <input type="checkbox" name="equipos" data-lista value="${e._id}" ${ids.includes(e._id) ? 'checked' : ''}>
          <span>${escapar(e.nombre)} <small class="mono">${escapar(e.noInventario)}</small>
          ${e.sala ? `<small>· ${e.sala._id === salaId ? 'en esta sala' : escapar(e.sala.clave)}</small>` : ''}</span>
        </label>`).join('')
      : '<p class="muted">No hay equipo disponible para préstamo.</p>';
  }

  /* ---------- Disponibilidad de la sala ---------- */
  const aMin = (h) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };

  const actualizarDisponibilidad = debounce(async () => {
    const salaId = form.elements.sala.value;
    const fecha = form.elements.fecha.value;
    const sala = salas.find((s) => s._id === salaId);
    $('#ayuda-capacidad').textContent = sala ? `Capacidad de ${sala.clave}: ${sala.capacidad} personas.` : '';
    form.elements.asistentes.max = sala?.capacidad ?? 500;
    if (!salaId || !fecha) { panelDisp.hidden = true; return; }

    try {
      const d = await api(`/salas/${salaId}/disponibilidad?fecha=${fecha}`);
      const ocupado = d.ocupado.filter((o) => o._id !== reservaEditando?._id);
      const abre = aMin(d.sala.horaApertura);
      const total = aMin(d.sala.horaCierre) - abre;
      const pos = (h) => Math.min(100, Math.max(0, ((aMin(h) - abre) / total) * 100));

      const bloques = ocupado.map((o) => `<div class="linea-tiempo__bloque${o.estado === 'pendiente' ? ' linea-tiempo__bloque--pendiente' : ''}"
        style="left:${pos(o.horaInicio)}%;width:${pos(o.horaFin) - pos(o.horaInicio)}%" title="${o.horaInicio}–${o.horaFin}"></div>`).join('');

      const hi = form.elements.horaInicio.value;
      const hf = form.elements.horaFin.value;
      const seleccion = hi && hf && hf > hi
        ? `<div class="linea-tiempo__seleccion" style="left:${pos(hi)}%;width:${Math.max(pos(hf) - pos(hi), 0.5)}%"></div>` : '';

      const choca = hi && hf && ocupado.some((o) => o.horaInicio < hf && o.horaFin > hi);
      const fuera = hi && hf && (hi < d.sala.horaApertura || hf > d.sala.horaCierre);

      panelDisp.innerHTML = `
        <div><strong>${escapar(d.sala.clave)}</strong> · ${escapar(capitalizar(formatoDiaLargo.format(new Date(`${fecha}T12:00`))))}
          · abre de <span class="mono">${d.sala.horaApertura}</span> a <span class="mono">${d.sala.horaCierre}</span></div>
        <div class="linea-tiempo" role="img" aria-label="Horario ocupado de la sala">${bloques}${seleccion}</div>
        <div class="linea-tiempo__horas"><span>${d.sala.horaApertura}</span><span>${d.sala.horaCierre}</span></div>
        <div class="leyenda"><span style="--c:var(--primario-suave)">Libre</span><span style="--c:var(--peligro)">Aprobada</span><span style="--c:var(--acento)">Pendiente</span></div>
        ${ocupado.length
          ? `<ul class="ocupados">${ocupado.map((o) => `<li><span class="mono">${o.horaInicio}–${o.horaFin}</span> · ${escapar(o.usuario?.nombreCompleto ?? 'Usuario eliminado')} ${badge(o.estado)}</li>`).join('')}</ul>`
          : '<p>La sala está libre todo el día.</p>'}
        ${fuera ? `<p class="error">El horario elegido está fuera del servicio de la sala.</p>` : ''}
        ${choca ? `<p class="error">El horario elegido se cruza con otra reserva.</p>` : ''}`;
      panelDisp.hidden = false;
    } catch (err) {
      panelDisp.innerHTML = `<p class="error">No se pudo consultar la disponibilidad: ${escapar(err.message)}</p>`;
      panelDisp.hidden = false;
    }
  }, 200);

  ['sala', 'fecha', 'horaInicio', 'horaFin'].forEach((campo) => {
    form.elements[campo].addEventListener('change', actualizarDisponibilidad);
    form.elements[campo].addEventListener('input', actualizarDisponibilidad);
  });
  form.elements.sala.addEventListener('change', () => pintarEquipos(datosFormulario(form).equipos || []));

  /* ---------- Fila de la tabla ---------- */
  function fila(r) {
    const inicio = new Date(r.inicio);
    const fin = new Date(r.fin);
    const terminada = fin <= new Date();
    const activa = ['pendiente', 'aprobada'].includes(r.estado);
    const estado = activa && terminada ? 'terminada' : r.estado;

    const botones = [];
    const cancelar = '<button type="button" class="btn btn--sm btn--peligro" data-accion="cancelar">Cancelar</button>';
    if (admin) {
      if (activa && !terminada) {
        if (r.estado === 'pendiente') {
          botones.push('<button type="button" class="btn btn--sm btn--ok" data-accion="aprobar">Aprobar</button>');
          botones.push('<button type="button" class="btn btn--sm" data-accion="rechazar">Rechazar</button>');
        }
        botones.push('editar', cancelar);
      } else {
        botones.push('eliminar');
      }
    } else if (activa && !terminada) {
      // El alumno edita solo mientras está pendiente; una aprobada solo se puede cancelar
      if (r.estado === 'pendiente') botones.push('editar');
      botones.push(cancelar);
    }

    return `
      <tr data-id="${r._id}">
        <td data-label="Cuándo"><div class="principal">${escapar(describirDia(inicio))}</div><div class="sub mono">${horaLocal(inicio)}–${horaLocal(fin)}</div></td>
        <td data-label="Sala">${r.sala ? `<div class="principal mono">${escapar(r.sala.clave)}</div><div class="sub">${escapar(r.sala.nombre)}</div>` : '<span class="sub">Sala eliminada</span>'}</td>
        ${admin ? `<td data-label="Solicitante">${r.usuario
          ? `<div class="principal">${escapar(r.usuario.nombreCompleto)}</div><div class="sub"><span class="mono">${escapar(r.usuario.noControl)}</span>${r.usuario.carrera ? ` · ${escapar(r.usuario.carrera)}` : ` · ${escapar(capitalizar(r.usuario.rol))}`}</div>`
          : '<span class="sub">Usuario eliminado</span>'}</td>` : ''}
        <td data-label="Detalle"><div>${escapar(r.motivo)}</div><div class="sub">${r.asistentes} ${r.asistentes === 1 ? 'persona' : 'personas'}${r.equipos?.length ? ` · ${r.equipos.map((e) => escapar(e.nombre)).join(', ')}` : ''}</div></td>
        <td data-label="Estado">${badge(estado)}</td>
        ${botonesFila(...botones)}
      </tr>`;
  }

  async function cambiarEstado(item, estado, recargar, mensaje) {
    try {
      await api(`/reservas/${item._id}`, { method: 'PUT', body: { estado } });
      toast(mensaje);
      await recargar();
      actualizarDisponibilidad();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const crud = crearCrud({
    formAbierto: Boolean(params.get('sala')), // viene de "Reservar" en salas
    recurso: 'reservas',
    columnas: admin ? 6 : 5,
    textos: { nuevo: 'Nueva reserva', editar: 'Editar reserva', creado: admin ? 'Reserva registrada como pendiente.' : 'Solicitud enviada. Queda pendiente hasta que el encargado la apruebe.', actualizado: 'Reserva actualizada', eliminado: 'Reserva eliminada del historial' },
    describir: (r) => `la reserva de ${r.sala?.clave ?? 'sala eliminada'} del ${describirDia(r.inicio).toLowerCase()} de ${horaLocal(new Date(r.inicio))} a ${horaLocal(new Date(r.fin))}`,
    fila,
    prepararDatos: (datos, { editando }) => {
      datos.equipos ??= [];
      if (!editando || !admin) delete datos.estado;
      if (!admin) datos.usuario = sesion.usuario._id; // el servidor también lo toma de la sesión
      return datos;
    },
    rellenar: (f, r) => {
      const inicio = new Date(r.inicio);
      // Si el usuario o la sala ya no están en las listas (inactivo / no disponible), se agregan para poder editar
      if (admin && r.usuario && ![...f.elements.usuario.options].some((o) => o.value === r.usuario._id)) {
        f.elements.usuario.add(new Option(`${r.usuario.noControl} · ${r.usuario.nombreCompleto}`, r.usuario._id));
      }
      if (r.sala && ![...f.elements.sala.options].some((o) => o.value === r.sala._id)) {
        f.elements.sala.add(new Option(`${r.sala.clave} · ${r.sala.nombre}`, r.sala._id));
      }
      if (admin) f.elements.usuario.value = r.usuario?._id ?? '';
      f.elements.sala.value = r.sala?._id ?? '';
      f.elements.fecha.value = fechaISO(inicio);
      f.elements.horaInicio.value = horaLocal(inicio);
      f.elements.horaFin.value = horaLocal(new Date(r.fin));
      f.elements.asistentes.value = r.asistentes;
      f.elements.motivo.value = r.motivo;
      // Solo se muestran los estados a los que se puede pasar
      if (admin) {
        const permitidos = r.estado === 'pendiente' ? ['pendiente', 'aprobada', 'rechazada', 'cancelada'] : ['aprobada', 'cancelada'];
        llenarSelect(f.elements.estado, permitidos);
        f.elements.estado.value = r.estado;
      }
      pintarEquipos(r.equipos || []);
    },
    alCambiarModo: (modo, item) => {
      reservaEditando = modo === 'editar' ? item : null;
      if (admin) {
        $('#campo-estado').hidden = modo !== 'editar';
        form.elements.estado.disabled = modo !== 'editar';
      }
      if (modo === 'crear') {
        if (params.get('sala')) form.elements.sala.value = params.get('sala');
        pintarEquipos();
      }
      actualizarDisponibilidad();
    },
    alGuardar: (r, { editando }) => {
      if (editando && r.estado === 'pendiente' && reservaEditando?.estado === 'aprobada') {
        toast('Cambiaste sala u horario: la reserva volvió a quedar pendiente de aprobación.', 'aviso');
      }
    },
    acciones: {
      aprobar: (item, recargar) => cambiarEstado(item, 'aprobada', recargar, 'Reserva aprobada'),
      rechazar: async (item, recargar) => {
        if (await confirmar(`Se rechazará ${`la solicitud de ${item.usuario?.nombreCompleto ?? 'este usuario'}`}. El horario quedará libre.`, { titulo: '¿Rechazar reserva?', textoOk: 'Rechazar' })) {
          await cambiarEstado(item, 'rechazada', recargar, 'Reserva rechazada');
        }
      },
      cancelar: async (item, recargar) => {
        if (await confirmar('La sala y el equipo quedarán libres en ese horario. Después podrás eliminarla del historial.', { titulo: '¿Cancelar reserva?', textoOk: 'Sí, cancelar' })) {
          await cambiarEstado(item, 'cancelada', recargar, 'Reserva cancelada');
        }
      },
    },
  });

  // Fecha por defecto: hoy; inicio a la siguiente hora en punto
  const siguiente = new Date(); siguiente.setHours(siguiente.getHours() + 1, 0, 0, 0);
  form.addEventListener('reset', () => setTimeout(() => {
    form.elements.fecha.value = fechaISO(siguiente);
  }));
  form.elements.fecha.value = fechaISO(siguiente);

  pintarEquipos();
  actualizarDisponibilidad();
  crud.cargar();
})();
