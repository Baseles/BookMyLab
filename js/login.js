// Inicio de sesión con correo institucional y contraseña. No hay registro: las cuentas ya existen.
(function () {
  const form = $('#form-login');
  const email = form.elements.email;
  const password = form.elements.password;
  const errorGeneral = $('#error-general');
  const aviso = $('#aviso');
  const params = new URLSearchParams(location.search);

  $('#zona-tema').append(crearBotonTema());
  email.placeholder = `l23400686@${DOMINIO_INSTITUCIONAL}`;

  // Si ya hay sesión, no tiene caso volver a pedirla
  if (obtenerSesion()?.usuario) {
    location.replace(destinoSeguro());
    return;
  }

  const MOTIVOS = {
    expirada: 'Tu sesión expiró. Vuelve a iniciar sesión.',
    salio: 'Cerraste sesión correctamente.',
  };
  if (MOTIVOS[params.get('motivo')]) {
    aviso.textContent = MOTIVOS[params.get('motivo')];
    aviso.hidden = false;
  }

  // Solo se permite regresar a rutas de este mismo sitio
  function destinoSeguro() {
    const volver = params.get('volver');
    return volver && volver.startsWith('/') && !volver.startsWith('//') && !volver.startsWith('/login') ? volver : '/';
  }

  function mostrarErrorGeneral(mensaje) {
    errorGeneral.textContent = mensaje;
    errorGeneral.hidden = !mensaje;
  }

  function validar() {
    limpiarErrores(form);
    mostrarErrorGeneral('');
    const correo = email.value.trim().toLowerCase();
    const clave = password.value;
    const errores = {};

    if (!correo) errores.email = 'Escribe tu correo institucional';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) errores.email = 'El correo no tiene un formato válido';
    else if (!correo.endsWith(`@${DOMINIO_INSTITUCIONAL}`)) errores.email = `Usa tu correo institucional (@${DOMINIO_INSTITUCIONAL})`;

    if (!clave) errores.password = 'Escribe tu contraseña';
    else if (clave.length < 8) errores.password = 'La contraseña tiene al menos 8 caracteres';

    mostrarErrores(form, errores);
    return Object.keys(errores).length ? null : { email: correo, password: clave, recordar: form.elements.recordar.checked };
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    aviso.hidden = true;
    const datos = validar();
    if (!datos) return;

    const boton = $('[type="submit"]', form);
    await conCarga(boton, 'Verificando…', async () => {
      try {
        const respuesta = await api('/auth/login', { method: 'POST', body: datos });
        guardarSesion({ token: respuesta.token, usuario: respuesta.usuario }, form.elements.recordar.checked);
        location.replace(destinoSeguro());
      } catch (err) {
        password.value = '';
        if (err.status === 400 && mostrarErrores(form, err.campos)) return;
        // 401: credenciales incorrectas · 403: cuenta desactivada · 429: demasiados intentos
        const mensajes = {
          401: 'Correo o contraseña incorrectos.',
          0: err.message,
        };
        mostrarErrorGeneral(mensajes[err.status] ?? err.message);
        (err.status === 401 ? password : email).focus();
      }
    });
  });

  // Quitar el error de un campo en cuanto se corrige
  form.addEventListener('input', (e) => {
    if (e.target.name) {
      e.target.removeAttribute('aria-invalid');
      const caja = $(`[data-error-for="${e.target.name}"]`, form);
      if (caja) caja.textContent = '';
    }
  });

  // Mostrar / ocultar contraseña
  $('#ver-clave').addEventListener('click', (e) => {
    const visible = password.type === 'text';
    password.type = visible ? 'password' : 'text';
    e.currentTarget.textContent = visible ? 'Mostrar' : 'Ocultar';
    e.currentTarget.setAttribute('aria-pressed', String(!visible));
    password.focus();
  });

  // Aviso de Bloq Mayús
  const avisoMayus = $('#aviso-mayus');
  ['keydown', 'keyup'].forEach((tipo) => password.addEventListener(tipo, (e) => {
    avisoMayus.hidden = !e.getModifierState?.('CapsLock');
  }));
  password.addEventListener('blur', () => { avisoMayus.hidden = true; });

  email.focus();
})();
