// middlewares/errorHandler.js

const errorHandler = (err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Hubo un error en el servidor.' });
};

module.exports = errorHandler;
