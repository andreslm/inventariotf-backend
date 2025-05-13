// middlewares/authMiddleware.js
const { expressjwt: jwt } = require('express-jwt');
const secret = 'Perla2043-'; // Cambia esto por una clave secreta más segura

// Middleware para verificar el token JWT
const checkAuth = jwt({
  secret: secret,
  algorithms: ['HS256'], // Algoritmo de encriptación
  requestProperty: 'user', // Donde se almacenará el usuario decodificado
});

module.exports = checkAuth;
