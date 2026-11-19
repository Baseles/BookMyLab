// Pantalla de usuarios: CRUD de alumnos y docentes + búsqueda por No. de control o nombre.
(async function () {
  if (!requerirSesion({ roles: ['admin'] })) return;
  const { CARRERAS } = await catalogos().catch((err) => { toast(err.message, 'error'); return { CARRERAS: [] }; });
  llenarSelect($('#carrera'), CARRERAS, { vacio: 'Selecciona…' });
  llenarSelect($('#f-carrera'), CARRERAS, { vacio: 'Todas' });

  const form = $('#form');
  const noControl = $('#noControl');

  // Las reglas del No. de control y la carrera cambian según el rol
  function aplicarRol() {
    const docente = form.elements.rol.value !== 'alumno'; // docente o admin: No. de empleado
    $('#et-noControl').textContent = docente ? 'No. de empleado' : 'No. de control';
    noControl.pattern = docente ? '[A-Za-z0-9]{4,13}' : '[A-Za-z]?[0-9]{8}';
    noControl.placeholder = docente ? 'D1045' : '23400686';
    noControl.inputMode = docente ? 'text' : 'numeric';
    noControl.dataset.msg = docente ? 'De 4 a 13 letras o números' : 'Deben ser 8 dígitos (ej. 23400686)';
    $('#ayuda-noControl').textContent = docente
      ? 'Número de empleado asignado por la institución.'
      : '8 dígitos. Si tienes letra al inicio (ej. C19400123), inclúyela.';
    $('#campo-carrera').hidden = docente;
    $('#campo-semestre').hidden = docente;
    form.elements.carrera.disabled = docente; // los campos deshabilitados no se envían ni se validan
    form.elements.semestre.disabled = docente;
    form.elements.email.placeholder = docente ? `nombre.apellido@${DOMINIO_INSTITUCIONAL}` : `l23400686@${DOMINIO_INSTITUCIONAL}`;
  }

  // Correo institucional: alumnos usan l + No. de control; se sugiere mientras escriben
  noControl.addEventListener('input', () => {
    const email = form.elements.email;
    const sugerido = (v) => `l${v.toLowerCase()}@${DOMINIO_INSTITUCIONAL}`;
    if (form.elements.rol.value === 'alumno' && (!email.value || email.dataset.sugerido === email.value)) {
      email.value = noControl.value ? sugerido(noControl.value.trim()) : '';
      email.dataset.sugerido = email.value;
    }
  });
  form.elements.email.pattern = `[^\\s@]+@${DOMINIO_INSTITUCIONAL.replace(/[.\-]/g, '\\$&')}`;
  form.elements.email.dataset.msg = `Debe ser un correo @${DOMINIO_INSTITUCIONAL}`;
  $$('input[name="rol"]').forEach((r) => r.addEventListener('change', aplicarRol));
  form.addEventListener('reset', () => setTimeout(aplicarRol));

  const crud = crearCrud({
    recurso: 'usuarios',
    columnas: 6,
    textos: { nuevo: 'Nuevo usuario', editar: 'Editar usuario', creado: 'Usuario registrado', actualizado: 'Usuario actualizado', eliminado: 'Usuario eliminado' },
    describir: (u) => `a ${u.nombreCompleto} (${u.noControl}) junto con su historial de reservas`,
    prepararDatos: (datos) => {
      if (datos.rol !== 'alumno') { datos.carrera = ''; datos.semestre = ''; }
      datos.email = datos.email.toLowerCase();
      return datos;
    },
    fila: (u) => `
      <tr data-id="${u._id}">
        <td data-label="No. control" class="mono principal">${escapar(u.noControl)}</td>
        <td data-label="Nombre"><div class="principal">${escapar(u.nombreCompleto)}</div>${u.email ? `<div class="sub">${escapar(u.email)}</div>` : ''}</td>
        <td data-label="Carrera">${u.carrera ? `${escapar(u.carrera)}${u.semestre ? `<div class="sub">${u.semestre}.º semestre</div>` : ''}` : '<span class="sub">—</span>'}</td>
        <td data-label="Rol">${badge(u.rol)}</td>
        <td data-label="Estado">${badge(u.activo ? 'activo' : 'inactivo')}</td>
        ${botonesFila(`<a class="btn btn--sm" href="/reservas?noControl=${encodeURIComponent(u.noControl)}&periodo=">Reservas</a>`, 'editar', 'eliminar')}
      </tr>`,
    rellenar: (f, u) => {
      f.elements.password.value = '';
      $(`input[name="rol"][value="${u.rol}"]`, f).checked = true;
      aplicarRol();
      for (const campo of ['noControl', 'nombreCompleto', 'carrera', 'semestre', 'email']) f.elements[campo].value = u[campo] ?? '';
      f.elements.activo.checked = u.activo;
    },
    alCambiarModo: (modo) => {
      // Al crear la contraseña es obligatoria; al editar, vacía = no se cambia
      const editando = modo === 'editar';
      form.elements.password.required = !editando;
      form.elements.password.value = '';
      $('#et-password').textContent = editando ? 'Nueva contraseña' : 'Contraseña inicial';
      $('#ayuda-password').textContent = editando
        ? 'Déjala vacía para no cambiarla. Si la cambias, se cierran sus sesiones abiertas.'
        : 'Mínimo 8 caracteres. Compártela con la persona para que entre.';
      if (modo === 'crear') aplicarRol();
    },
  });

  aplicarRol();
  crud.cargar();
})();
