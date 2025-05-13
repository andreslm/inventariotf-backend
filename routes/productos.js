// routes/productos.js
const express = require('express');
const checkAuth = require('../middlewares/authMiddleware');
const pool = require('../models/db'); // Asegúrate de tener la conexión a la base de datos
const router = express.Router();

// Ruta para listar productos
router.get('/productos', checkAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM productos');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener los productos' });
  }
});

// routes/productos.js

router.get('/productos/bajos', checkAuth, async (req, res) => {
  try {
    const umbral = 10; // Puedes cambiar el valor del umbral
    const result = await pool.query(
      'SELECT * FROM productos WHERE cantidad <= $1',
      [umbral]
    );

    if (result.rows.length === 0) {
      return res.json({ message: 'No hay productos con cantidad baja.' });
    }

    res.json(result.rows); // Retorna los productos con cantidad baja
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al verificar productos bajos' });
  }
});

router.get('/productos/:id/seriales', checkAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT id, serial FROM producto_seriales WHERE producto_id = $1 AND entregado = false',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener seriales:', err);
    res.status(500).json({ message: 'Error al obtener seriales' });
  }
});


// Ruta para agregar un nuevo producto
router.post('/productos', checkAuth, async (req, res) => {
  const { nombre, tipo_unidad, cantidad, observaciones, seriales, stock_minimo } = req.body;

  console.log('▶️ Body recibido:', req.body);

  if (!nombre || !tipo_unidad || !cantidad) {
    return res.status(400).json({ message: 'Faltan campos obligatorios' });
  }

  const requiereSerial = /onu|repetidor/i.test(nombre);
  if (requiereSerial) {
    if (!seriales || !Array.isArray(seriales) || seriales.length !== parseInt(cantidad)) {
      return res.status(400).json({
        message: 'Debe ingresar seriales válidos y coincidentes con la cantidad'
      });
    }
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 👇 Lógica de existencia
    const check = await client.query(
      'SELECT * FROM productos WHERE LOWER(nombre) = LOWER($1)',
      [nombre]
    );

    let productoId;

    if (check.rows.length > 0) {
      productoId = check.rows[0].id;
      await client.query(
        'UPDATE productos SET cantidad = cantidad + $1 WHERE id = $2',
        [cantidad, productoId]
      );
    } else {
      const insert = await client.query(
        'INSERT INTO productos (nombre, tipo_unidad, cantidad, observaciones, stock_minimo) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [nombre, tipo_unidad, cantidad, observaciones, req.body.stock_minimo || 5]
      );
      productoId = insert.rows[0].id;
    }

    // 👇 Seriales (si aplica)
    if (requiereSerial) {
      console.log('▶️ Insertando seriales:', seriales);
      for (const serial of seriales) {
        const exists = await client.query(
          'SELECT 1 FROM producto_seriales WHERE serial = $1',
          [serial]
        );

        if (exists.rowCount > 0) {
          throw { code: 'SERIAL_DUPLICADO', serial };
        }

        await client.query(
          'INSERT INTO producto_seriales (producto_id, serial) VALUES ($1, $2)',
          [productoId, serial]
        );
      }
    }

    await client.query('COMMIT');
    res.status(200).json({ message: check.rows.length > 0 ? 'Stock actualizado' : 'Producto creado correctamente' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error al agregar producto:', error);

    if (error.code === 'SERIAL_DUPLICADO') {
      return res.status(400).json({ message: `El serial "${error.serial}" ya existe.` });
    }

    res.status(500).json({ message: 'Error en el servidor' });
  } finally {
    client.release();
  }
});

// Devolver un producto serializado al inventario
router.put('/productos/:productoId/devolver-serial', checkAuth, async (req, res) => {
  const { productoId } = req.params;
  const { serial } = req.body;

  if (!serial) {
    return res.status(400).json({ message: 'Debe proporcionar el serial a devolver' });
  }

  try {
    // Validar que el serial existe y pertenece al producto
    const result = await pool.query(
      'SELECT id, entregado FROM producto_seriales WHERE producto_id = $1 AND serial = $2',
      [productoId, serial]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Serial no encontrado para este producto' });
    }

    const serialId = result.rows[0].id;
    const yaEnStock = result.rows[0].entregado === false;

    if (yaEnStock) {
      return res.status(400).json({ message: 'Este serial ya está en inventario' });
    }

    // 1. Marcar como no entregado
    await pool.query('UPDATE producto_seriales SET entregado = false WHERE id = $1', [serialId]);

    // 2. Incrementar stock del producto
    await pool.query('UPDATE productos SET cantidad = cantidad + 1 WHERE id = $1', [productoId]);

    res.json({ message: 'Producto devuelto al inventario correctamente' });
  } catch (error) {
    console.error('Error al devolver serial:', error);
    res.status(500).json({ message: 'Error al devolver producto al inventario' });
  }
});



// Ruta para editar un producto
router.put('/productos/:id', checkAuth, async (req, res) => {
  const { id } = req.params;
  const { nombre, tipo_unidad, cantidad, observaciones, stock_minimo, seriales } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Actualizar el producto principal
    const result = await client.query(
      'UPDATE productos SET nombre = $1, tipo_unidad = $2, cantidad = $3, observaciones = $4, stock_minimo = $5 WHERE id = $6 RETURNING *',
      [nombre, tipo_unidad, cantidad, observaciones, stock_minimo, id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    // Si el producto tiene seriales, primero eliminamos los anteriores
    await client.query('DELETE FROM producto_seriales WHERE producto_id = $1', [id]);

    // Insertar nuevos seriales si existen
    if (seriales && seriales.length > 0) {
      for (const serial of seriales) {
        await client.query(
          'INSERT INTO producto_seriales (producto_id, serial) VALUES ($1, $2)',
          [id, serial]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Producto actualizado correctamente' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Error al editar el producto' });
  } finally {
    client.release();
  }
});


// Eliminar producto
// Eliminar producto solo si no ha sido usado en órdenes
router.delete('/productos/:id', checkAuth, async (req, res) => {
  const { id } = req.params;

  try {
    // Validar si existe en alguna orden
    const check = await pool.query('SELECT 1 FROM orden_detalle WHERE producto_id = $1 LIMIT 1', [id]);
    if (check.rows.length > 0) {
      return res.status(400).json({
        message: '❌ No se puede eliminar este producto porque ya fue utilizado en una orden de entrega.'
      });
    }

    // Eliminar seriales asociados si existen
    await pool.query('DELETE FROM producto_seriales WHERE producto_id = $1', [id]);

    // Eliminar el producto
    await pool.query('DELETE FROM productos WHERE id = $1', [id]);

    res.json({ message: '✅ Producto eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ message: 'Error al eliminar producto' });
  }
});


// Agregar stock a un producto existente
router.post('/productos/ingresar-stock', checkAuth, async (req, res) => {
  const { producto_id, cantidad, seriales } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Actualizar cantidad del producto
    await client.query(
      'UPDATE productos SET cantidad = cantidad + $1 WHERE id = $2',
      [cantidad, producto_id]
    );

    // 2. Insertar seriales (si aplica)
    if (seriales && seriales.length > 0) {
      for (const serial of seriales) {
        await client.query(
          'INSERT INTO producto_seriales (producto_id, serial) VALUES ($1, $2)',
          [producto_id, serial]
        );
      }
    }

    await client.query('COMMIT');
    res.status(200).json({ message: 'Stock actualizado correctamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al ingresar stock:', error);
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Uno o más seriales ya existen' });
    }
    res.status(500).json({ message: 'Error al ingresar stock' });
  } finally {
    client.release();
  }
});

// Obtener seriales entregados de un producto
router.get('/productos/:id/seriales-entregados', checkAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT serial FROM producto_seriales WHERE producto_id = $1 AND entregado = true ORDER BY serial',
      [id]
    );
    res.json(result.rows); // devuelve [{ serial: "123" }, { serial: "456" }]
  } catch (error) {
    console.error('Error al obtener seriales entregados:', error);
    res.status(500).json({ message: 'Error al obtener seriales' });
  }
});


module.exports = router;
