const express = require('express');
const router = express.Router();
const pool = require('../models/db');
const checkAuth = require('../middlewares/authMiddleware');

// Crear orden
router.post('/ordenes', checkAuth, async (req, res) => {
  const { tecnico, productos } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Insertar encabezado
    const ordenResult = await client.query(
      'INSERT INTO ordenes (tecnico) VALUES ($1) RETURNING id',
      [tecnico]
    );
    const ordenId = ordenResult.rows[0].id;

    // 2. Insertar detalles y validar stock
    for (const prod of productos) {
      // Obtener stock y nombre del producto
      const stockRes = await client.query(
        'SELECT nombre, cantidad FROM productos WHERE id = $1',
        [prod.producto_id]
      );

      if (stockRes.rows.length === 0) {
        throw new Error(`Producto con ID ${prod.producto_id} no encontrado.`);
      }

      const { nombre, cantidad } = stockRes.rows[0];

      if (cantidad < prod.cantidad) {
        throw new Error(`Stock insuficiente para "${nombre}". Stock actual: ${cantidad}, solicitado: ${prod.cantidad}`);
      }

      // 1. Insertar orden_detalle y obtener su ID
	const detalleRes = await client.query(
	  'INSERT INTO orden_detalle (orden_id, producto_id, cantidad) VALUES ($1, $2, $3) RETURNING id',
	  [ordenId, prod.producto_id, prod.cantidad]
	);
	const detalleId = detalleRes.rows[0].id;

	// 2. Si hay seriales, asociarlos
	if (prod.seriales && Array.isArray(prod.seriales)) {
	  console.log('▶️ Insertando seriales:', prod.seriales);
	  for (const serial of prod.seriales) {
		console.log('Buscando serial:', serial, typeof serial, 'para producto', prod.producto_id);
		const serialRes = await client.query(
		  'SELECT id FROM producto_seriales WHERE id = $1::int AND producto_id = $2 AND entregado = false',
		  [serial, prod.producto_id]
		);



		if (serialRes.rows.length === 0) {
		  throw new Error(`Serial "${serial}" no encontrado o ya asignado.`);
		}

		const serialId = serialRes.rows[0].id;

		// Insertar relación en orden_detalle_seriales
		await client.query(
		  'INSERT INTO orden_detalle_seriales (orden_detalle_id, serial_id) VALUES ($1, $2)',
		  [detalleId, serialId]
		);

		// Opcional: marcar el serial como fuera de stock
		await client.query(
		  'UPDATE producto_seriales SET entregado = true WHERE id = $1',
		  [serialId]
		);
	  }
	}


      // Descontar del stock
      await client.query(
        'UPDATE productos SET cantidad = cantidad - $1 WHERE id = $2',
        [prod.cantidad, prod.producto_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Orden registrada con éxito', ordenId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear orden:', error);

    const message = error.message.includes('Stock insuficiente') || error.message.includes('no encontrado')
      ? error.message
      : 'Error al crear orden';

    res.status(400).json({ message });
  } finally {
    client.release();
  }
});

// Listar órdenes recientes con sus detalles
// Listar órdenes recientes con seriales
router.get('/ordenes', checkAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.id AS orden_id, o.tecnico, o.fecha,
             p.nombre AS producto, od.cantidad,
             ps.serial
      FROM ordenes o
      JOIN orden_detalle od ON o.id = od.orden_id
      JOIN productos p ON od.producto_id = p.id
      LEFT JOIN orden_detalle_seriales ods ON od.id = ods.orden_detalle_id
      LEFT JOIN producto_seriales ps ON ods.serial_id = ps.id
      ORDER BY o.fecha DESC
    `);

    const ordenesMap = new Map();

    result.rows.forEach(row => {
      if (!ordenesMap.has(row.orden_id)) {
        ordenesMap.set(row.orden_id, {
          orden_id: row.orden_id,
          tecnico: row.tecnico,
          fecha: row.fecha,
          productos: []
        });
      }

      const orden = ordenesMap.get(row.orden_id);
      let producto = orden.productos.find(p => p.producto === row.producto);

      if (!producto) {
        producto = {
          producto: row.producto,
          cantidad: row.cantidad,
          seriales: []
        };
        orden.productos.push(producto);
      }

      if (row.serial && !producto.seriales.includes(row.serial)) {
        producto.seriales.push(row.serial);
      }
    });

    res.json(Array.from(ordenesMap.values()));
  } catch (error) {
    console.error('Error al obtener órdenes:', error);
    res.status(500).json({ message: 'Error al obtener órdenes' });
  }
});

router.get('/ordenes/:id', checkAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`
      SELECT 
        o.id AS orden_id,
        o.tecnico,
        o.fecha,
        p.nombre AS producto,
        od.cantidad,
        ps.serial
      FROM ordenes o
      JOIN orden_detalle od ON o.id = od.orden_id
      JOIN productos p ON od.producto_id = p.id
      LEFT JOIN orden_detalle_seriales ods ON od.id = ods.orden_detalle_id
      LEFT JOIN producto_seriales ps ON ods.serial_id = ps.id
      WHERE o.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    const datos = result.rows;
    const orden = {
      orden_id: datos[0].orden_id,
      tecnico: datos[0].tecnico,
      fecha: datos[0].fecha,
      productos: []
    };

    // Agrupar productos y seriales
    datos.forEach(row => {
      let producto = orden.productos.find(p => p.producto === row.producto);
      if (!producto) {
        producto = {
          producto: row.producto,
          cantidad: row.cantidad,
          seriales: []
        };
        orden.productos.push(producto);
      }

      if (row.serial) {
        producto.seriales.push(row.serial);
      }
    });

    res.json(orden);

  } catch (error) {
    console.error('Error al obtener orden por ID:', error);
    res.status(500).json({ message: 'Error al obtener orden' });
  }
});


module.exports = router;
