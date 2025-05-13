// controllers/authController.js
const pool = require('../models/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Usuario no encontrado' });
    }

    const usuario = result.rows[0];

    const passwordValida = await bcrypt.compare(password, usuario.password);
    if (!passwordValida) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }

    // Crear Token
    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Login exitoso',
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};
