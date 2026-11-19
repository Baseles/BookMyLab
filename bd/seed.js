// Carga datos de ejemplo. ¡Borra las colecciones usuarios, salas, equipos y reservas!
// Uso: npm run seed
require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });
const mongoose = require('mongoose');
const Usuario = require('./modelos/usuario.modelo');
const Sala = require('./modelos/sala.modelo');
const Equipo = require('./modelos/equipo.modelo');
const Reserva = require('./modelos/reserva.modelo');
const Sesion = require('./modelos/sesion.modelo');

// Fecha relativa a hoy: en(1, '08:00') = mañana a las 8:00
function en(dias, hora) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const [h, m] = hora.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('Falta MONGO_URI en bd/.env');
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Conectado a ${mongoose.connection.name}. Borrando datos anteriores...`);
  await Promise.all([Usuario, Sala, Equipo, Reserva, Sesion].map((M) => M.deleteMany({})));
  await Promise.all([Usuario, Sala, Equipo, Reserva, Sesion].map((M) => M.syncIndexes()));

  const [lc1, lc2, le1, lq1, aud, sj, a12] = await Sala.create([
    { clave: 'LC-01', nombre: 'Laboratorio de Cómputo 1', tipo: 'sala de cómputo', edificio: 'K', capacidad: 30, horaApertura: '07:00', horaCierre: '21:00', descripcion: '30 equipos con Windows y Linux, proyector fijo' },
    { clave: 'LC-02', nombre: 'Laboratorio de Cómputo 2', tipo: 'sala de cómputo', edificio: 'K', capacidad: 25, horaApertura: '07:00', horaCierre: '20:00' },
    { clave: 'LE-01', nombre: 'Laboratorio de Electrónica', tipo: 'laboratorio', edificio: 'L', capacidad: 24, horaApertura: '08:00', horaCierre: '19:00', descripcion: 'Mesas con fuentes de poder y generadores de funciones' },
    { clave: 'LQ-01', nombre: 'Laboratorio de Química', tipo: 'laboratorio', edificio: 'Q', capacidad: 20, horaApertura: '08:00', horaCierre: '16:00', descripcion: 'Uso obligatorio de bata y lentes' },
    { clave: 'AUD-1', nombre: 'Auditorio Principal', tipo: 'auditorio', edificio: 'A', capacidad: 180, horaApertura: '08:00', horaCierre: '20:00' },
    { clave: 'SJ-01', nombre: 'Sala de Juntas Académica', tipo: 'sala de juntas', edificio: 'A', capacidad: 12, horaApertura: '08:00', horaCierre: '18:00' },
    { clave: 'A-12', nombre: 'Aula 12', tipo: 'aula', edificio: 'B', capacidad: 40, horaApertura: '07:00', horaCierre: '21:00', disponible: false, descripcion: 'En mantenimiento: cambio de luminarias' },
  ]);

  const equipos = await Equipo.create([
    { noInventario: 'PRY-0012', nombre: 'Proyector Epson PowerLite', tipo: 'proyector', sala: sj._id },
    { noInventario: 'PRY-0015', nombre: 'Proyector BenQ MS560', tipo: 'proyector', sala: lc2._id },
    { noInventario: 'LAP-0101', nombre: 'Laptop Dell Latitude 5420', tipo: 'laptop', sala: lc1._id },
    { noInventario: 'LAP-0102', nombre: 'Laptop Dell Latitude 5420', tipo: 'laptop', sala: lc1._id },
    { noInventario: 'OSC-0003', nombre: 'Osciloscopio Rigol DS1054Z', tipo: 'osciloscopio', sala: le1._id },
    { noInventario: 'OSC-0004', nombre: 'Osciloscopio Rigol DS1054Z', tipo: 'osciloscopio', sala: le1._id, estado: 'en reparación', notas: 'Canal 2 sin señal' },
    { noInventario: 'MUL-0020', nombre: 'Multímetro Fluke 115', tipo: 'multímetro', sala: le1._id },
    { noInventario: 'MIC-0007', nombre: 'Microscopio Leica DM500', tipo: 'microscopio', sala: lq1._id },
    { noInventario: 'ROB-0002', nombre: 'Kit Arduino Mega + sensores', tipo: 'kit de robótica', sala: le1._id },
    { noInventario: 'BOC-0001', nombre: 'Bocina JBL EON 610', tipo: 'bocina', sala: aud._id, estado: 'dañado', notas: 'Bocina reventada' },
  ]);

  // Contraseñas de prueba (se guardan cifradas). Cámbialas si usas una BD real.
  const CLAVES = { admin: 'Admin1234', docente: 'Docente1234', alumno: 'Alumno1234' };
  const conClave = (u) => ({ ...u, password: CLAVES[u.rol ?? 'alumno'] });

  const [ana, luis, sofia, diego, mariana, jorge, profRuiz, profMendez] = await Usuario.create([
    { noControl: '23400451', nombreCompleto: 'Ana Karen López Martínez', carrera: 'Ingeniería en Sistemas Computacionales', semestre: 5, email: 'l23400451@campus.edu.mx' },
    { noControl: '22400318', nombreCompleto: 'Luis Fernando Gómez Ruiz', carrera: 'Ingeniería Electrónica', semestre: 7, email: 'l22400318@campus.edu.mx' },
    { noControl: '24400019', nombreCompleto: 'Sofía Hernández Castillo', carrera: 'Ingeniería Química', semestre: 3, email: 'l24400019@campus.edu.mx' },
    { noControl: '21400777', nombreCompleto: 'Diego Alejandro Ramírez Soto', carrera: 'Ingeniería Mecatrónica', semestre: 9, email: 'l21400777@campus.edu.mx' },
    { noControl: 'C19400123', nombreCompleto: 'Mariana Torres Aguilar', carrera: 'Ingeniería Industrial', semestre: 11, email: 'lc19400123@campus.edu.mx' },
    { noControl: '23400902', nombreCompleto: 'Jorge Iván Morales Pérez', carrera: 'Ingeniería Informática', semestre: 5, email: 'l23400902@campus.edu.mx', activo: false },
    { noControl: 'D1045', rol: 'docente', nombreCompleto: 'Patricia Ruiz Delgado', email: 'pruiz@campus.edu.mx' },
    { noControl: 'D0872', rol: 'docente', nombreCompleto: 'Roberto Méndez Ibarra', email: 'rmendez@campus.edu.mx' },
    { noControl: 'ADMIN01', rol: 'admin', nombreCompleto: 'Administrador Centro de Cómputo', email: 'admin@campus.edu.mx' },
  ].map(conClave));

  const [pry12, , lap1, , osc3, , mul20, mic7, rob2] = equipos;
  await Reserva.create([
    // Pasadas (historial)
    { usuario: ana._id, sala: lc1._id, inicio: en(-3, '10:00'), fin: en(-3, '12:00'), asistentes: 4, motivo: 'Práctica de bases de datos NoSQL', estado: 'aprobada' },
    { usuario: profRuiz._id, sala: aud._id, inicio: en(-2, '09:00'), fin: en(-2, '11:00'), asistentes: 120, motivo: 'Conferencia de inducción a primer semestre', estado: 'aprobada' },
    { usuario: luis._id, sala: le1._id, equipos: [osc3._id], inicio: en(-1, '12:00'), fin: en(-1, '14:00'), asistentes: 3, motivo: 'Pruebas de filtro pasa bajas', estado: 'cancelada' },
    // Próximas
    { usuario: luis._id, sala: le1._id, equipos: [osc3._id, mul20._id], inicio: en(1, '10:00'), fin: en(1, '12:00'), asistentes: 3, motivo: 'Proyecto de residencia: medición de señales', estado: 'aprobada' },
    { usuario: sofia._id, sala: lq1._id, equipos: [mic7._id], inicio: en(1, '08:00'), fin: en(1, '10:00'), asistentes: 5, motivo: 'Práctica de microbiología', estado: 'pendiente' },
    { usuario: profMendez._id, sala: lc1._id, equipos: [lap1._id], inicio: en(1, '16:00'), fin: en(1, '18:00'), asistentes: 28, motivo: 'Clase de reposición de Programación Web', estado: 'aprobada' },
    { usuario: diego._id, sala: le1._id, equipos: [rob2._id], inicio: en(2, '13:00'), fin: en(2, '15:30'), asistentes: 4, motivo: 'Armado de prototipo para el concurso de robótica', estado: 'pendiente' },
    { usuario: profRuiz._id, sala: sj._id, equipos: [pry12._id], inicio: en(3, '09:00'), fin: en(3, '10:30'), asistentes: 8, motivo: 'Reunión de academia', estado: 'pendiente' },
    { usuario: mariana._id, sala: lc2._id, inicio: en(3, '17:00'), fin: en(3, '19:00'), asistentes: 6, motivo: 'Asesoría de simulación con FlexSim', estado: 'rechazada' },
  ]);

  const total = await Promise.all([Usuario, Sala, Equipo, Reserva].map((M) => M.countDocuments()));
  console.log(`Listo: ${total[0]} usuarios, ${total[1]} salas, ${total[2]} equipos, ${total[3]} reservas.`);
  console.log(`Cuentas de prueba:
  Admin    admin@campus.edu.mx      / ${CLAVES.admin}
  Docente  pruiz@campus.edu.mx      / ${CLAVES.docente}
  Alumno   l23400451@campus.edu.mx  / ${CLAVES.alumno}`);
  void jorge; void a12;
}

main()
  .catch((err) => {
    console.error('Error en seed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
