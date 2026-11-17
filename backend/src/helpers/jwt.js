const jwt = require('jsonwebtoken');

/**
 * Token hanya berisi id user. Role, site, dan status aktif selalu dibaca
 * ulang dari database oleh middleware authenticate.
 */
const signToken = (user) =>
  jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });

const verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET);

module.exports = { signToken, verifyToken };
