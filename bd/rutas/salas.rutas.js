const { Router } = require('express');
const c = require('../controladores/salas.controlador');
const validarId = require('../middlewares/validarId');

const router = Router();
router.param('id', validarId);

router.route('/').get(c.listar).post(c.crear);
router.route('/:id').get(c.obtener).put(c.actualizar).delete(c.eliminar);
router.get('/:id/disponibilidad', c.disponibilidad);

module.exports = router;
