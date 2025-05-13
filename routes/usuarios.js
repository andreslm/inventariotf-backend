const express = require('express');
const router = express.Router();
const pool = require('../models/db');
const checkAuth = require('../middlewares/authMiddleware');
const bcrypt = require('bcryptjs');


router.get('/usuarios', checkAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nombre, email, rol FROM usuarios ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
});

// POST, PUT y DELETE también deben estar aquí...

// Crear nuevo usuario
router.post('/usuarios', checkAuth, async (req, res) => {
  const { nombre, email, password, rol } = req.body;

  if (!nombre || !email || !password || !rol) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    // Verificar email único
    const existe = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existe.rows.length > 0) {
      return res.status(400).json({ message: 'El email ya está en uso' });
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO usuarios (nombre, email, password, rol) VALUES ($1, $2, $3, $4)',
      [nombre, email, hash, rol]
    );

    res.status(201).json({ message: 'Usuario creado exitosamente' });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ message: 'Error al crear usuario' });
  }
});


// Resetear contraseña
router.put('/usuarios/:id/password', checkAuth, async (req, res) => {
  const { password } = req.body;
  const { id } = req.params;

  if (!password || password.length < 6) {
    return res.status(400).json({ message: 'Contraseña inválida (mínimo 6 caracteres)' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE usuarios SET password = $1 WHERE id = $2', [hash, id]);
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error al actualizar contraseña:', error);
    res.status(500).json({ message: 'Error al actualizar contraseña' });
  }
});

// Eliminar usuario
router.delete('/usuarios/:id', checkAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ message: 'Error al eliminar usuario' });
  }
});

// Editar usuario (nombre, email, rol)
router.put('/usuarios/:id', checkAuth, async (req, res) => {
  const { id } = req.params;
  const { nombre, email, rol } = req.body;

  try {
    // Validar email único (excepto el actual)
    const existe = await pool.query('SELECT id FROM usuarios WHERE email = $1 AND id <> $2', [email, id]);
    if (existe.rows.length > 0) {
      return res.status(400).json({ message: 'El correo ya está en uso por otro usuario' });
    }

    const result = await pool.query(
      'UPDATE usuarios SET nombre = $1, email = $2, rol = $3 WHERE id = $4 RETURNING *',
      [nombre, email, rol, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({ message: 'Usuario actualizado correctamente', usuario: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ message: 'Error al actualizar usuario' });
  }
});

module.exports = router;
