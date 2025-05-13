const bcrypt = require('bcryptjs');

async function generarPassword() {
  const passwordPlana = '123456'; // Puedes cambiar aquí la contraseña que quieras
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(passwordPlana, salt);
  console.log('Password encriptado:', hash);
}

generarPassword();
