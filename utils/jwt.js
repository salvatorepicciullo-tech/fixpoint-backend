const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fixpoint_super_secret';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { signToken, verifyToken };
