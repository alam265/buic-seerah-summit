const { Pool } = require('pg');
require('dotenv').config();

const bcrypt = require('bcryptjs');

let pool = null;
let isNeonConnected = false;
let dbError = null;
let dbInitPromise = null;
let initRetryUsed = false;

const INIT_RETRY_DELAYS_MS = [1000, 2000, 3000, 5000];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeDatabaseUrl(url) {
  if (!url) return url;
  // channel_binding=require breaks pg on some serverless runtimes (e.g. Vercel)
  return url.replace(/[&?]channel_binding=[^&]*/gi, '').replace(/\?&/, '?').replace(/\?$/, '');
}

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS registrations (
    id SERIAL PRIMARY KEY,
    ticket_id VARCHAR(30) UNIQUE NOT NULL,
    competition VARCHAR(20) NOT NULL DEFAULT 'quiz',
    full_name VARCHAR(100) NOT NULL,
    student_id VARCHAR(50) NOT NULL,
    semester VARCHAR(20) NOT NULL,
    department VARCHAR(100) NOT NULL,
    whatsapp VARCHAR(20) NOT NULL,
    facebook_link TEXT,
    gsuit_email VARCHAR(100) NOT NULL,
    personal_email VARCHAR(100) NOT NULL,
    gender VARCHAR(20) NOT NULL,
    bkash_txn_id VARCHAR(50) NOT NULL,
    uswatun_hasanah_read VARCHAR(10),
    uswatun_hasanah_participation VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS book_registrations (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    gsuit_email VARCHAR(100) NOT NULL,
    whatsapp VARCHAR(20) NOT NULL,
    is_participant BOOLEAN NOT NULL DEFAULT FALSE,
    amount_tk INTEGER NOT NULL,
    payment_method VARCHAR(20) NOT NULL,
    txn_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

const MIGRATION_SQL = `
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS student_id VARCHAR(50) NOT NULL DEFAULT 'N/A';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS semester VARCHAR(20) NOT NULL DEFAULT 'N/A';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS department VARCHAR(100) NOT NULL DEFAULT 'N/A';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20) NOT NULL DEFAULT 'N/A';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS facebook_link TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS gsuit_email VARCHAR(100) NOT NULL DEFAULT 'N/A';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS personal_email VARCHAR(100) NOT NULL DEFAULT 'N/A';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS gender VARCHAR(20) NOT NULL DEFAULT 'Other';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS bkash_txn_id VARCHAR(50) NOT NULL DEFAULT 'N/A';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS uswatun_hasanah_read VARCHAR(10);
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS uswatun_hasanah_participation VARCHAR(200);
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS competition VARCHAR(20) NOT NULL DEFAULT 'quiz';
ALTER TABLE registrations DROP COLUMN IF EXISTS email;
ALTER TABLE registrations DROP COLUMN IF EXISTS phone;
ALTER TABLE registrations DROP COLUMN IF EXISTS roll_no;
ALTER TABLE registrations DROP COLUMN IF EXISTS institution;
ALTER TABLE registrations DROP COLUMN IF EXISTS category;
ALTER TABLE registrations DROP COLUMN IF EXISTS address;
ALTER TABLE registrations DROP COLUMN IF EXISTS seerah_read_before;
ALTER TABLE registrations DROP COLUMN IF EXISTS engagement_suggestions;
ALTER TABLE registrations DROP COLUMN IF EXISTS programme_expectation;
ALTER TABLE registrations DROP COLUMN IF EXISTS invitation_source;
`;

const INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_registrations_student_id ON registrations(student_id);
CREATE INDEX IF NOT EXISTS idx_registrations_whatsapp ON registrations(whatsapp);
CREATE INDEX IF NOT EXISTS idx_registrations_gsuit_email ON registrations(gsuit_email);
CREATE INDEX IF NOT EXISTS idx_registrations_personal_email ON registrations(personal_email);
CREATE INDEX IF NOT EXISTS idx_registrations_ticket_id ON registrations(ticket_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_student_competition ON registrations(student_id, competition);
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
CREATE INDEX IF NOT EXISTS idx_book_registrations_student_id ON book_registrations(student_id);
CREATE INDEX IF NOT EXISTS idx_book_registrations_whatsapp ON book_registrations(whatsapp);
`;

async function seedDefaultAdmin(client) {
  try {
    const res = await client.query('SELECT COUNT(*) FROM admins');
    const count = parseInt(res.rows[0].count, 10);
    if (count === 0) {
      const defaultUser = process.env.ADMIN_USERNAME || 'admin';
      const defaultPass = process.env.ADMIN_PASSWORD || 'admin123';
      const hashedPassword = await bcrypt.hash(defaultPass, 10);
      await client.query('INSERT INTO admins (username, password) VALUES ($1, $2)', [defaultUser, hashedPassword]);
      console.log(`🔐 Default admin created -> Username: ${defaultUser}, Password: ${defaultPass}`);
    }
  } catch (err) {
    console.error('⚠️ Could not seed admin user:', err.message);
  }
}

function isDatabaseConfigured() {
  const dbUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
  return Boolean(dbUrl && dbUrl.trim() !== '' && !dbUrl.includes('your_password_here'));
}

function createDbNotReadyError(message) {
  const err = new Error(message || 'Database is not ready. Please try again in a moment.');
  err.code = 'DB_NOT_READY';
  err.dbError = dbError;
  return err;
}

async function teardownPool() {
  if (!pool) return;
  try {
    await pool.end();
  } catch (_) {
    // ignore pool shutdown errors between retries
  }
  pool = null;
}

async function connectDatabase(dbUrl) {
  pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('neon.tech') || dbUrl.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined
  });

  const client = await pool.connect();
  console.log('✅ Connected to Neon PostgreSQL Database successfully!');

  await client.query(CREATE_TABLES_SQL);
  await client.query(MIGRATION_SQL);
  await client.query(INDEXES_SQL);
  await seedDefaultAdmin(client);
  console.log('✅ Database tables (registrations, book_registrations & admins) verified in Neon DB.');
  client.release();

  isNeonConnected = true;
  dbError = null;
}

async function initDatabase() {
  const rawUrl = process.env.DATABASE_URL;
  const dbUrl = normalizeDatabaseUrl(rawUrl);
  if (!isDatabaseConfigured()) {
    console.log('⚠️ DATABASE_URL is not set or using placeholder. Running in Local Fallback mode.');
    isNeonConnected = false;
    dbError = 'DATABASE_URL not configured in .env file.';
    return;
  }

  isNeonConnected = false;
  dbError = null;

  for (let attempt = 0; attempt < INIT_RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      console.log(`⏳ Retrying Neon connection (${attempt + 1}/${INIT_RETRY_DELAYS_MS.length})...`);
      await sleep(INIT_RETRY_DELAYS_MS[attempt - 1]);
      await teardownPool();
    }

    try {
      await connectDatabase(dbUrl);
      return;
    } catch (err) {
      console.error(`❌ Neon Database connection failed (attempt ${attempt + 1}):`, err.message);
      isNeonConnected = false;
      dbError = err.message;
      await teardownPool();
    }
  }
}

function resetDbInit() {
  dbInitPromise = null;
}

function getPool() {
  return pool;
}

function getDbStatus() {
  return {
    isNeonConnected,
    dbError
  };
}

/** Wait for DB init (required on serverless — login must not run before Neon is ready). */
function ensureDbReady() {
  if (!dbInitPromise) {
    dbInitPromise = initDatabase();
  }
  return dbInitPromise;
}

/** Await Neon init, then return pool + connection status (use in all write/read paths). */
async function getDbContext() {
  await ensureDbReady();

  // One extra init round per instance if Neon was still waking up on first cold start
  if (!isNeonConnected && isDatabaseConfigured() && !initRetryUsed) {
    initRetryUsed = true;
    resetDbInit();
    await ensureDbReady();
  }

  return {
    isNeonConnected,
    pool: getPool(),
    dbError
  };
}

/** Throw when DATABASE_URL is set but Neon is not connected (avoids silent empty fallback). */
function requireNeonOrLocalDev() {
  if (isDatabaseConfigured() && !isNeonConnected) {
    throw createDbNotReadyError();
  }
}

module.exports = {
  initDatabase,
  ensureDbReady,
  getDbContext,
  getPool,
  getDbStatus,
  isDatabaseConfigured,
  createDbNotReadyError,
  requireNeonOrLocalDev
};
