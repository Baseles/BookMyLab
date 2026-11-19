// Pantalla de equipos: CRUD del inventario + filtros por tipo, estado y sala.
(async function () {
  if (!requerirSesion({ roles: ['admin'] })) return;
  const params = new URLSearchParams(location.search);
  let cat = { TIPOS_EQUIPO: [], ESTADOS_EQUIPO: [] };
  let salas = [];
  try {
    [cat, salas] = await Promise.all([catalogos(), api('/salas')]);
  } catch (err) {
    toast(err.message, 'error');
  }
  const opcionesSala = salas.map((s) => ({ valor: s._id, texto: `${s.clave} · ${s.nombre}` }));

  llenarSelect($('#tipo'), cat.TIPOS_EQUIPO, { vacio: 'Selecciona…' });
  llenarSelect($('#estado'), cat.ESTADOS_EQUIPO);
  llenarSelect($('#sala'), opcionesSala, { vacio: salas.length ? 'Selecciona…' : 'Primero registra una sala' });
  llenarSelect($('#f-tipo'), cat.TIPOS_EQUIPO, { vacio: 'Todos' });
  llenarSelect($('#f-estado'), cat.ESTADOS_EQUIPO, { vacio: 'Todos' });
  llenarSelect($('#f-sala'), opcionesSala, { vacio: 'Todas' });
  if (params.get('estado')) $('#f-estado').value = params.get('estado');

  const crud = crearCrud({
    recurso: 'equipos',
    columnas: 5,
    textos: { nuevo: 'Nuevo equipo', editar: 'Editar equipo', creado: 'Equipo registrado', actualizado: 'Equipo actualizado', eliminado: 'Equipo eliminado' },
    describir: (e) => `${e.nombre} (${e.noInventario})`,
    fila: (e) => `
      <tr data-id="${e._id}">
        <td data-label="Equipo"><div class="principal">${escapar(e.nombre)}</div><div class="sub mono">${escapar(e.noInventario)}</div></td>
        <td data-label="Tipo">${escapar(capitalizar(e.tipo))}</td>
        <td data-label="Ubicación">${e.sala ? `<span class="mono">${escapar(e.sala.clave)}</span> <span class="sub">· Edif. ${escapar(e.sala.edificio)}</span>` : '<span class="sub">Sin sala</span>'}</td>
        <td data-label="Estado">${badge(e.estado)}${e.notas ? `<div class="sub">${escapar(e.notas)}</div>` : ''}</td>
        ${botonesFila('editar', 'eliminar')}
      </tr>`,
    rellenar: (form, e) => {
      for (const campo of ['noInventario', 'nombre', 'tipo', 'estado', 'notas']) form.elements[campo].value = e[campo] ?? '';
      form.elements.sala.value = e.sala?._id ?? '';
    },
    alGuardar: (r) => {
      if (r.reservasAfectadas > 0) {
        toast(`Se retiró de ${r.reservasAfectadas} reserva(s) próxima(s) porque ya no está en buen estado.`, 'aviso');
      }
    },
  });

  crud.cargar();
})();
