// Pantalla de inicio: contadores, próximas reservas y salas más usadas (GET /api/resumen).
(async function () {
  const sesion = requerirSesion();
  if (!sesion) return;

  const nombre = sesion.usuario.nombreCompleto.split(' ')[0];
  const hora = new Date().getHours();
  $('#saludo').textContent = `${hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'}, ${nombre}`;
  if (new URLSearchParams(location.search).get('motivo') === 'sin-permiso') {
    toast('Esa sección es solo para administradores.', 'aviso');
    history.replaceState(null, '', '/');
  }

  if (!esAdmin(sesion)) return pintarMisReservas();

  const stats = $('#stats');
  const proximas = $('#proximas');
  const uso = $('#uso');
  stats.innerHTML = Array.from({ length: 5 }, (_, i) => `
    <div class="stat stat--esqueleto">${i === 0 ? AVISO_CARGA : ''}<span class="esqueleto esqueleto--valor"></span>${lineaEsqueleto(i % 2 ? 'medio' : 'largo')}</div>`).join('');
  proximas.innerHTML = listaEsqueleto(4);
  uso.innerHTML = Array.from({ length: 4 }, (_, i) => `
    <li class="item-esqueleto"><div class="barras__fila">${lineaEsqueleto(i % 2 ? 'medio' : 'largo')}${lineaEsqueleto('corto')}</div><span class="esqueleto esqueleto--barra"></span></li>`).join('');

  try {
    const { contadores: c, proximas: lista, salasMasUsadas } = await api('/resumen');

    const tarjetas = [
      { valor: c.reservasHoy, etiqueta: 'reservas para hoy', href: `/reservas?fecha=${fechaISO(new Date())}` },
      { valor: c.pendientes, etiqueta: 'pendientes de aprobar', href: '/reservas?estado=pendiente', clase: c.pendientes ? 'stat--pendiente' : '' },
      { valor: `${c.salasDisponibles}/${c.salas}`, etiqueta: 'salas disponibles', href: '/salas' },
      { valor: c.equiposConFalla, etiqueta: 'equipos dañados o en reparación', href: '/equipos?estado=dañado', clase: c.equiposConFalla ? 'stat--alerta' : '' },
      { valor: c.usuarios, etiqueta: 'usuarios activos', href: '/usuarios' },
    ];
    stats.innerHTML = tarjetas.map((t) => `
      <a class="stat ${t.clase || ''}" href="${t.href}">
        <span class="stat__valor">${escapar(t.valor)}</span>
        <span class="stat__etiqueta">${escapar(t.etiqueta)}</span>
      </a>`).join('');

    proximas.innerHTML = lista.length
      ? lista.map((r) => {
        const inicio = new Date(r.inicio);
        return `<li>
          <div class="fecha-bloque"><strong>${horaLocal(inicio)}</strong><span>${escapar(describirDia(inicio))}</span></div>
          <div>
            <div class="principal">${escapar(r.sala?.clave ?? 'Sala eliminada')} · ${escapar(r.sala?.nombre ?? '')}</div>
            <div class="sub muted">${escapar(r.usuario?.nombreCompleto ?? 'Usuario eliminado')} <span class="mono">${escapar(r.usuario?.noControl ?? '')}</span> — ${escapar(r.motivo)}</div>
          </div>
          ${badge(r.estado)}
        </li>`;
      }).join('')
      : '<li class="vacio">No hay reservas próximas. <a href="/reservas">Crea la primera</a>.</li>';

    const max = Math.max(...salasMasUsadas.map((s) => s.horas), 1);
    uso.innerHTML = salasMasUsadas.length
      ? salasMasUsadas.map((s) => `
        <li>
          <div class="barras__fila"><span><strong>${escapar(s.clave)}</strong> ${escapar(s.nombre)}</span><span class="muted">${s.horas} h · ${s.reservas} ${s.reservas === 1 ? 'reserva' : 'reservas'}</span></div>
          <div class="barras__pista"><div class="barras__relleno" style="width:${(s.horas / max) * 100}%"></div></div>
        </li>`).join('')
      : '<li class="vacio">Aún no hay datos de uso.</li>';
  } catch (err) {
    stats.innerHTML = `<div class="stat"><span class="stat__etiqueta">No se pudo cargar el resumen: ${escapar(err.message)}</span></div>`;
    proximas.innerHTML = '';
    uso.innerHTML = '';
    toast(err.message, 'error');
  } finally {
    stats.removeAttribute('aria-busy');
  }
})();

// Vista de alumno/docente: solo sus próximas reservas (el servidor filtra por la sesión)
async function pintarMisReservas() {
  const lista = $('#mias');
  lista.innerHTML = listaEsqueleto(3);
  try {
    const reservas = await api('/reservas?periodo=proximas');
    lista.innerHTML = reservas.length
      ? reservas.slice(0, 6).map((r) => {
        const inicio = new Date(r.inicio);
        return `<li>
          <div class="fecha-bloque"><strong>${horaLocal(inicio)}</strong><span>${escapar(describirDia(inicio))}</span></div>
          <div>
            <div class="principal">${escapar(r.sala?.clave ?? 'Sala eliminada')} · ${escapar(r.sala?.nombre ?? '')}</div>
            <div class="sub muted">${horaLocal(inicio)}–${horaLocal(new Date(r.fin))} · ${escapar(r.motivo)}</div>
          </div>
          ${badge(r.estado)}
        </li>`;
      }).join('')
      : '<li class="vacio">No tienes reservas próximas. <a href="/reservas">Aparta una sala</a>.</li>';
  } catch (err) {
    lista.innerHTML = `<li class="vacio">No se pudieron cargar tus reservas: ${escapar(err.message)}</li>`;
  }
}
