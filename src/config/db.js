const { Pool } = require('pg');
require('dotenv').config();

const bcrypt = require('bcryptjs');

let pool = null;
let isNeonConnected = false;
let dbError = null;
let dbInitPromise = null;

function normalizeDatabaseUrl(url) {
  if (!url) return url;
  // channel_binding=require breaks pg on some serverless runtimes (e.g. Vercel)
  return url.replace(/[&?]channel_binding=[^&]*/gi, '').replace(/\?&/, '?').replace(/\?$/, '');
}

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS registrations (
    id SERIAL PRIMARY KEY,
    ticket_id VARCHAR(30) UNIQUE NOT NULL,
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
    seerah_read_before TEXT,
    engagement_suggestions TEXT,
    programme_expectation TEXT,
    invitation_source VARCHAR(150),
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
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS seerah_read_before TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS engagement_suggestions TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS programme_expectation TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS invitation_source VARCHAR(150);
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS uswatun_hasanah_read VARCHAR(10);
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS uswatun_hasanah_participation VARCHAR(200);
ALTER TABLE registrations DROP COLUMN IF EXISTS email;
ALTER TABLE registrations DROP COLUMN IF EXISTS phone;
ALTER TABLE registrations DROP COLUMN IF EXISTS roll_no;
ALTER TABLE registrations DROP COLUMN IF EXISTS institution;
ALTER TABLE registrations DROP COLUMN IF EXISTS category;
ALTER TABLE registrations DROP COLUMN IF EXISTS address;
`;

const INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_registrations_student_id ON registrations(student_id);
CREATE INDEX IF NOT EXISTS idx_registrations_whatsapp ON registrations(whatsapp);
CREATE INDEX IF NOT EXISTS idx_registrations_gsuit_email ON registrations(gsuit_email);
CREATE INDEX IF NOT EXISTS idx_registrations_personal_email ON registrations(personal_email);
CREATE INDEX IF NOT EXISTS idx_registrations_ticket_id ON registrations(ticket_id);
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

async function initDatabase() {
  const rawUrl = process.env.DATABASE_URL;
  const dbUrl = normalizeDatabaseUrl(rawUrl);
  if (!dbUrl || dbUrl.trim() === '' || dbUrl.includes('your_password_here')) {
    console.log('⚠️ DATABASE_URL is not set or using placeholder. Running in Local Fallback mode.');
    isNeonConnected = false;
    dbError = 'DATABASE_URL not configured in .env file.';
    return;
  }

  try {
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
  } catch (err) {
    console.error('❌ Neon Database connection failed:', err.message);
    isNeonConnected = false;
    dbError = err.message;
  }
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
  return {
    isNeonConnected,
    pool: getPool(),
    dbError
  };
}

module.exports = {
  initDatabase,
  ensureDbReady,
  getDbContext,
  getPool,
  getDbStatus
};
