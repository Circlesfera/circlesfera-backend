const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    console.error('Auth middleware: No hay token');
    return res.status(401).json({ message: 'No hay token, autorización denegada' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    console.log('Auth middleware: usuario autenticado', decoded);
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Token no válido' });
  }
};
