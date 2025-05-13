// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas
const authRoutes = require('./routes/authRoutes');
const productosRoutes = require('./routes/productos'); // Rutas de productos
const errorHandler = require('./middlewares/errorHandler'); // Importa el middleware de error
const ordenRoutes = require('./routes/ordenes');
const tecnicoRoutes = require('./routes/tecnicos');
const reportesRoutes = require('./routes/reportes');
const usuariosRoutes = require('./routes/usuarios');


app.use('/api', authRoutes);
app.use('/api', productosRoutes); // Rutas de productos
app.use(errorHandler); // Usa el middleware de error
app.use('/api', ordenRoutes);
app.use('/api', tecnicoRoutes);
app.use('/api', reportesRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api', usuariosRoutes);


// Ruta de prueba
app.get('/', (req, res) => {
  res.send('Servidor funcionando ✅');
});

// Puerto
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));

