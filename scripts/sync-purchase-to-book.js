/**
 * One-time sync: competition registrants who chose
 * "Yes, I want to purchase Uswatun Hasanah, and participate"
 * but are not yet in book_registrations.
 *
 * Inserts one book row per student_id with:
 *   payment_method = cash, amount_tk = 150, is_participant = true
 *
 * Usage: node scripts/sync-purchase-to-book.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const PURCHASE_OPTION =
  'Yes, I want to purchase Uswatun Hasanah, and participate';

function normalizeDatabaseUrl(url) {
  if (!url) return url;
  return url
    .replace(/[&?]channel_binding=[^&]*/gi, '')
    .replace(/\?&/, '?')
    .replace(/\?$/, '');
}

async function main() {
  const dbUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
  if (!dbUrl || dbUrl.includes('your_password_here')) {
    console.error('DATABASE_URL is not configured.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl:
      dbUrl.includes('neon.tech') || dbUrl.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : undefined
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const missing = await client.query(
      `
      SELECT DISTINCT ON (r.student_id)
        r.student_id,
        r.full_name,
        r.gsuit_email,
        r.whatsapp
      FROM registrations r
      WHERE r.uswatun_hasanah_participation = $1
        AND NOT EXISTS (
          SELECT 1
          FROM book_registrations b
          WHERE b.student_id = r.student_id
        )
      ORDER BY r.student_id, r.created_at DESC
      `,
      [PURCHASE_OPTION]
    );

    console.log(`Found ${missing.rows.length} registrant(s) to sync.`);

    if (missing.rows.length === 0) {
      await client.query('COMMIT');
      return;
    }

    let inserted = 0;
    for (const row of missing.rows) {
      const result = await client.query(
        `
        INSERT INTO book_registrations (
          student_id, full_name, gsuit_email, whatsapp,
          is_participant, amount_tk, payment_method, txn_id
        )
        VALUES ($1, $2, $3, $4, TRUE, 150, 'cash', NULL)
        ON CONFLICT (student_id) DO NOTHING
        RETURNING id, student_id
        `,
        [row.student_id, row.full_name, row.gsuit_email, row.whatsapp]
      );

      if (result.rows.length > 0) {
        inserted += 1;
        console.log(`  + ${result.rows[0].student_id} (id=${result.rows[0].id})`);
      }
    }

    await client.query('COMMIT');
    console.log(`Done. Inserted ${inserted} book registration(s).`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Sync failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
