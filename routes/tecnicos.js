const express = require('express');
const router = express.Router();
const pool = require('../models/db');
const checkAuth = require('../middlewares/authMiddleware');

// Obtener lista de técnicos
router.get('/tecnicos', checkAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tecnicos');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener técnicos:', err);
    res.status(500).json({ message: 'Error al obtener técnicos' });
  }
});

// Crear nuevo técnico
router.post('/tecnicos', checkAuth, async (req, res) => {
  const { nombre } = req.body;
  try {
    await pool.query('INSERT INTO tecnicos (nombre) VALUES ($1)', [nombre]);
    res.json({ message: 'Técnico creado' });
  } catch (error) {
    console.error('Error al crear técnico:', error);
    res.status(500).json({ message: 'Error al crear técnico' });
  }
});

// Editar técnico
router.put('/tecnicos/:id', checkAuth, async (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;
  try {
    await pool.query('UPDATE tecnicos SET nombre = $1 WHERE id = $2', [nombre, id]);
    res.json({ message: 'Técnico actualizado' });
  } catch (error) {
    console.error('Error al editar técnico:', error);
    res.status(500).json({ message: 'Error al editar técnico' });
  }
});

// Eliminar técnico
router.delete('/tecnicos/:id', checkAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM tecnicos WHERE id = $1', [id]);
    res.json({ message: 'Técnico eliminado' });
  } catch (error) {
    console.error('Error al eliminar técnico:', error);
    res.status(500).json({ message: 'Error al eliminar técnico' });
  }
});

module.exports = router;
