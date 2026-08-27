const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool, getDbStatus, ensureDbReady } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'BUIC_Seerah_admin_secret_key_2026';

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
      let isMatch = false;

      if (adminRow.password.startsWith('$2a$') || adminRow.password.startsWith('$2b$')) {
        isMatch = await bcrypt.compare(password, adminRow.password);
      } else {
        // Support manual plain text password entry set by database admin in Neon SQL Editor
        isMatch = (adminRow.password === password);
      }

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
    let isPassMatch = false;

    if (fallbackAdmin.password.startsWith('$2a$') || fallbackAdmin.password.startsWith('$2b$')) {
      isPassMatch = await bcrypt.compare(password, fallbackAdmin.password);
    } else {
      isPassMatch = (fallbackAdmin.password === password);
    }

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
