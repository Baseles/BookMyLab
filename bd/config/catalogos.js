// Catálogos y reglas del negocio compartidos por modelos, controladores y frontend (/api/catalogos).

const CARRERAS = [
  'Ingeniería en Sistemas Computacionales',
  'Ingeniería Informática',
  'Ingeniería en Tecnologías de la Información y Comunicaciones',
  'Ingeniería Industrial',
  'Ingeniería en Gestión Empresarial',
  'Ingeniería Electrónica',
  'Ingeniería Eléctrica',
  'Ingeniería Mecatrónica',
  'Ingeniería Mecánica',
  'Ingeniería Civil',
  'Ingeniería Química',
  'Ingeniería Bioquímica',
  'Ingeniería en Logística',
  'Licenciatura en Administración',
  'Contador Público',
  'Arquitectura',
];

const ROLES = ['alumno', 'docente', 'admin'];
const TIPOS_SALA = ['laboratorio', 'sala de cómputo', 'aula', 'auditorio', 'sala de juntas'];
const TIPOS_EQUIPO = ['proyector', 'laptop', 'microscopio', 'osciloscopio', 'multímetro', 'kit de robótica', 'bocina', 'cámara', 'otro'];
const ESTADOS_EQUIPO = ['bueno', 'dañado', 'en reparación'];
const ESTADOS_RESERVA = ['pendiente', 'aprobada', 'rechazada', 'cancelada'];
// Estados que ocupan la sala/equipo (los que cuentan para choques de horario)
const ESTADOS_ACTIVOS = ['pendiente', 'aprobada'];

const REGLAS = {
  duracionMinimaMin: 30,      // una reserva dura al menos 30 minutos
  duracionMaximaMin: 240,     // y como máximo 4 horas
  maxReservasAlumno: 3,       // reservas próximas activas que puede tener un alumno
};

// No. de control: 8 dígitos, opcionalmente con una letra al inicio (ej. 23400686, C19400123)
const REGEX_NO_CONTROL = /^[A-Z]?\d{8}$/;
// No. de empleado de docentes: 4 a 13 letras o números
const REGEX_NO_EMPLEADO = /^[A-Z0-9]{4,13}$/;
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

module.exports = {
  CARRERAS, ROLES, TIPOS_SALA, TIPOS_EQUIPO, ESTADOS_EQUIPO, ESTADOS_RESERVA, ESTADOS_ACTIVOS,
  REGLAS, REGEX_NO_CONTROL, REGEX_NO_EMPLEADO, REGEX_HORA, REGEX_FECHA,
};
