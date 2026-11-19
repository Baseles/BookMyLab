// Conversión entre fecha + hora del formulario ("2026-11-12", "08:30") y objetos Date (hora local del servidor).
const { REGEX_FECHA, REGEX_HORA } = require('../config/catalogos');

const dosDigitos = (n) => String(n).padStart(2, '0');

function aFecha(fecha, hora) {
  if (!REGEX_FECHA.test(fecha || '') || !REGEX_HORA.test(hora || '')) return null;
  const d = new Date(`${fecha}T${hora}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const horaDe = (d) => `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;
const fechaDe = (d) => `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;

// Inicio y fin (exclusivo) de un día dado como "YYYY-MM-DD"
function rangoDelDia(fecha) {
  const inicio = aFecha(fecha, '00:00');
  if (!inicio) return null;
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 1);
  return { inicio, fin };
}

module.exports = { aFecha, horaDe, fechaDe, rangoDelDia };
