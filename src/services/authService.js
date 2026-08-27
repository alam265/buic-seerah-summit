const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool, getDbStatus, ensureDbReady } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'BUIC_Seerah_admin_secret_key_2026';

function isBcryptHash(storedPassword) {
  return /^\$2[abxy]\$/.test(String(storedPassword || ''));
}

function normalizeBcryptHash(storedPassword) {
  const hash = String(storedPassword || '');
  // PHP/phpMyAdmin often store bcrypt as $2y$ — bcryptjs expects $2a$
  if (hash.startsWith('$2y$')) {
    return '$2a$' + hash.slice(4);
  }
  return hash;
}

async function verifyStoredPassword(storedPassword, plainPassword) {
  const stored = String(storedPassword || '');
  const plain = String(plainPassword || '');

  if (isBcryptHash(stored)) {
    return bcrypt.compare(plain, normalizeBcryptHash(stored));
  }

  return stored.trim() === plain.trim();
}

// Local Fallback Admin User
const fallbackAdmin = {
  id: 1,
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'admin123'
};

async function authenticateAdmin(username, password) {
  if (!username || !password) return null;

  await ensureDbReady();

  const { isNeonConnected, dbError } = getDbStatus();
  const pool = getPool();

  if (isNeonConnected && pool) {
    try {
      const res = await pool.query('SELECT * FROM admins WHERE LOWER(username) = LOWER($1)', [username.trim()]);
      if (res.rows.length === 0) return null;

      const adminRow = res.rows[0];
      const isMatch = await verifyStoredPassword(adminRow.password, password);

      if (isMatch) {
        return { id: adminRow.id, username: adminRow.username };
      }
      return null;
    } catch (err) {
      console.error('Error verifying admin against Neon:', err.message, dbError || '');
      return null;
    }
  } else {
    console.warn('Admin login using env fallback (Neon not connected). dbError:', dbError || 'none');
    // Local Memory Fallback Mode
    const isUserMatch = (username.trim().toLowerCase() === fallbackAdmin.username.toLowerCase());
    const isPassMatch = await verifyStoredPassword(fallbackAdmin.password, password);

    if (isUserMatch && isPassMatch) {
      return { id: fallbackAdmin.id, username: fallbackAdmin.username };
    }
    return null;
  }
}

function generateAdminToken(adminPayload) {
  return jwt.sign(
    { id: adminPayload.id, username: adminPayload.username },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function verifyAdminToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

module.exports = {
  authenticateAdmin,
  generateAdminToken,
  verifyAdminToken
};
