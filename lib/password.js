'use strict';

const crypto = require('crypto');

function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(plain), salt, 64).toString('hex');
  return 's1$' + salt + '$' + derived;
}

function verifyPassword(plain, stored) {
  try {
    const [ver, salt, hash] = String(stored).split('$');
    if (ver !== 's1' || !salt || !hash) return false;
    const derived = crypto.scryptSync(String(plain), salt, 64).toString('hex');
    const a = Buffer.from(derived, 'hex');
    const b = Buffer.from(hash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (err) {
    return false;
  }
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

module.exports = { hashPassword, verifyPassword, randomToken };
