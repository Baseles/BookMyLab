const { Router } = require('express');
const c = require('../controladores/auth.controlador');
const { autenticar } = require('../middlewares/autenticacion');

const router = Router();
router.post('/login', c.login);
router.post('/logout', autenticar, c.logout);
router.get('/yo', autenticar, c.yo);

module.exports = router;
