const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(403).send({ message: 'No token provided!' });
  }

  const bearerToken = token.split(' ')[1];

  jwt.verify(bearerToken, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Unauthorized!' });
    }
    req.userId = decoded.id;
    req.userRole = decoded.role;
    req.companyId = decoded.companyId; // Available for all controllers
    next();
  });
};

const verifyAdmin = (req, res, next) => {
  if (req.userRole === 'superadmin') return next(); // Superadmin overrides
  if (req.userRole !== 'admin') {
    return res.status(403).send({ message: 'Require Admin Role!' });
  }
  next();
};

const verifySuperAdmin = (req, res, next) => {
  if (req.userRole !== 'superadmin') {
    return res.status(403).send({ message: 'Require SuperAdmin Role!' });
  }
  next();
};

module.exports = { verifyToken, verifyAdmin, verifySuperAdmin };
