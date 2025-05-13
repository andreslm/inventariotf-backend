// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Ruta de login
router.post('/login', authController.login);

// routes.js
const checkAuth = require('../middlewares/authMiddleware');

// Ejemplo de una ruta protegida
router.get('/perfil', checkAuth, (req, res) => {
  // Si llegamos aquí, es porque el token es válido
  res.json({
    message: 'Ruta protegida',
    usuario: req.user, // Aquí está la información del usuario decodificada
  });
});

module.exports = router;

