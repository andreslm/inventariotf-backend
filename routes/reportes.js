// routes/reportes.js
const express = require('express');
const router = express.Router();
const pool = require('../models/db');
const checkAuth = require('../middlewares/authMiddleware');

// Obtener seriales de productos tipo ONU o Repetidor
router.get('/seriales', checkAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        ps.serial, 
        ps.entregado,
        p.nombre AS producto,
        t.nombre AS tecnico,
        o.id AS orden_id
      FROM producto_seriales ps
      JOIN productos p ON ps.producto_id = p.id
      LEFT JOIN orden_detalle_seriales ods ON ps.id = ods.serial_id
      LEFT JOIN orden_detalle od ON ods.orden_detalle_id = od.id
      LEFT JOIN ordenes o ON od.orden_id = o.id
      LEFT JOIN tecnicos t ON o.tecnico = t.nombre
      WHERE LOWER(p.nombre) LIKE '%onu%' OR LOWER(p.nombre) LIKE '%repetidor%'
      ORDER BY p.nombre, ps.serial
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener seriales:', error);
    res.status(500).json({ message: 'Error al obtener seriales' });
  }
});

router.get('/productos', checkAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT nombre, tipo_unidad, cantidad, stock_minimo, observaciones
      FROM productos
      ORDER BY nombre
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ message: 'Error al generar reporte de productos' });
  }
});


module.exports = router;
