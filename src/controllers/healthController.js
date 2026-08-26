const { getDbStatus } = require('../config/db');
const { getRegistrationsCount } = require('../services/registrationService');

async function handleHealthCheck(req, res) {
  const { isNeonConnected, dbError } = getDbStatus();
  const count = await getRegistrationsCount();

  res.json({
    status: 'ok',
    isNeonConnected,
    dbError,
    totalRegistrations: count,
    envConfigured: Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0)
  });
}

module.exports = {
  handleHealthCheck
};
