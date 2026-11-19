// Pantalla de salas: CRUD + filtros por tipo, edificio, capacidad y disponibilidad.
(async function () {
  const sesion = requerirSesion();
  if (!sesion) return;
  const admin = esAdmin(sesion);

  const { TIPOS_SALA } = await catalogos().catch((err) => { toast(err.message, 'error'); return { TIPOS_SALA: [] }; });
  if (admin) llenarSelect($('#tipo'), TIPOS_SALA, { vacio: 'Selecciona…' });
  llenarSelect($('#f-tipo'), TIPOS_SALA, { vacio: 'Todos' });

  const crud = crearCrud({
    recurso: 'salas',
    columnas: 7,
    textos: { nuevo: 'Nueva sala', editar: 'Editar sala', creado: 'Sala registrada', actualizado: 'Sala actualizada', eliminado: 'Sala eliminada' },
    describir: (s) => `la sala ${s.clave} (${s.nombre})`,
    fila: (s) => `
      <tr data-id="${s._id}">
        <td data-label="Sala"><div class="principal mono">${escapar(s.clave)}</div><div class="sub">${escapar(s.nombre)}</div></td>
        <td data-label="Tipo">${escapar(capitalizar(s.tipo))}</td>
        <td data-label="Edificio">${escapar(s.edificio)}</td>
        <td data-label="Capacidad">${s.capacidad} personas</td>
        <td data-label="Horario" class="mono">${escapar(s.horaApertura)}–${escapar(s.horaCierre)}</td>
        <td data-label="Estado">${badge(s.disponible ? 'disponible' : 'no disponible')}</td>
        ${botonesFila(s.disponible ? `<a class="btn btn--sm btn--ok" href="/reservas?sala=${s._id}">Reservar</a>` : '', ...(admin ? ['editar', 'eliminar'] : []))}
      </tr>`,
    rellenar: (form, s) => {
      for (const campo of ['clave', 'nombre', 'tipo', 'edificio', 'capacidad', 'horaApertura', 'horaCierre', 'descripcion']) {
        form.elements[campo].value = s[campo] ?? '';
      }
      form.elements.disponible.checked = s.disponible;
    },
  });

  crud.cargar();
})();
