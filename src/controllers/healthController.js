const { getDbStatus, ensureDbReady, getPool } = require('../config/db');
const { getRegistrationsCount } = require('../services/registrationService');

async function handleHealthCheck(req, res) {
  await ensureDbReady();
  const { isNeonConnected, dbError } = getDbStatus();
  const count = await getRegistrationsCount();

  let adminCount = null;
  if (isNeonConnected && getPool()) {
    try {
      const adminRes = await getPool().query('SELECT COUNT(*) FROM admins');
      adminCount = parseInt(adminRes.rows[0].count, 10);
    } catch (_) {
      adminCount = -1;
    }
  }

  res.json({
    status: 'ok',
    isNeonConnected,
    dbError,
    adminCount,
    totalRegistrations: count,
    envConfigured: Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0),
    authMode: isNeonConnected ? 'database' : 'env_fallback'
  });
}

module.exports = {
  handleHealthCheck
};
