const { getDbContext, requireNeonOrLocalDev } = require('../config/db');
const { isCompetitionParticipant } = require('./registrationService');

const PARTICIPANT_PRICE = 150;
const REGULAR_PRICE = 220;
const HANDOVER_STATUSES = ['pending', 'received'];

const localBookRegistrations = [];
let localBookIdSeq = 1;

function sanitizeHandoverStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return HANDOVER_STATUSES.includes(status) ? status : 'pending';
}

function sanitizePersonalEmail(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed || trimmed.toUpperCase() === 'N/A') return '';
  return trimmed;
}

const REGISTRATION_PERSONAL_EMAIL_SQL = `
  SELECT personal_email
  FROM registrations
  WHERE personal_email IS NOT NULL
    AND TRIM(personal_email) <> ''
    AND UPPER(TRIM(personal_email)) <> 'N/A'
    AND (
      LOWER(TRIM(student_id)) = LOWER(TRIM($1))
      OR (
        $2 <> ''
        AND LOWER(TRIM(gsuit_email)) = LOWER(TRIM($2))
      )
    )
  ORDER BY
    CASE WHEN LOWER(TRIM(student_id)) = LOWER(TRIM($1)) THEN 0 ELSE 1 END,
    created_at DESC
  LIMIT 1
`;

async function lookupRegistrationPersonalEmail(pool, studentId, gsuitEmail) {
  const result = await pool.query(REGISTRATION_PERSONAL_EMAIL_SQL, [
    String(studentId || '').trim(),
    String(gsuitEmail || '').trim()
  ]);
  if (result.rows.length === 0) return '';
  return sanitizePersonalEmail(result.rows[0].personal_email);
}

async function backfillBookPersonalEmails(pool) {
  await pool.query(`
    UPDATE book_registrations b
    SET personal_email = src.personal_email
    FROM (
      SELECT DISTINCT ON (b2.id)
        b2.id,
        r.personal_email
      FROM book_registrations b2
      INNER JOIN registrations r
        ON (
          LOWER(TRIM(r.student_id)) = LOWER(TRIM(b2.student_id))
          OR (
            TRIM(b2.gsuit_email) <> ''
            AND LOWER(TRIM(r.gsuit_email)) = LOWER(TRIM(b2.gsuit_email))
          )
        )
      WHERE (b2.personal_email IS NULL OR TRIM(b2.personal_email) = '')
        AND r.personal_email IS NOT NULL
        AND TRIM(r.personal_email) <> ''
        AND UPPER(TRIM(r.personal_email)) <> 'N/A'
      ORDER BY
        b2.id,
        CASE WHEN LOWER(TRIM(r.student_id)) = LOWER(TRIM(b2.student_id)) THEN 0 ELSE 1 END,
        r.created_at DESC
    ) src
    WHERE b.id = src.id
  `);
}

function sanitizeGender(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed || trimmed.toUpperCase() === 'N/A') return '';
  return trimmed;
}

function mapBookRow(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    fullName: row.full_name,
    gsuitEmail: row.gsuit_email,
    personalEmail: sanitizePersonalEmail(row.personal_email),
    gender: sanitizeGender(row.gender),
    whatsapp: row.whatsapp,
    isParticipant: Boolean(row.is_participant),
    amountTk: row.amount_tk,
    paymentMethod: row.payment_method,
    senderBkashNumber: row.txn_id || '',
    handoverStatus: sanitizeHandoverStatus(row.handover_status),
    createdAt: row.created_at
  };
}

function resolveAmount(isParticipant) {
  return isParticipant ? PARTICIPANT_PRICE : REGULAR_PRICE;
}

async function lookupParticipantPricing(studentId) {
  const isParticipant = await isCompetitionParticipant(studentId);
  return {
    isParticipant,
    amountTk: resolveAmount(isParticipant),
    regularPrice: REGULAR_PRICE,
    participantPrice: PARTICIPANT_PRICE
  };
}

async function findBookRegistrationByStudentId(studentId) {
  const cleanId = String(studentId || '').trim();
  const { isNeonConnected, pool } = await getDbContext();

  if (isNeonConnected && pool) {
    const result = await pool.query(
      'SELECT * FROM book_registrations WHERE LOWER(TRIM(student_id)) = LOWER(TRIM($1)) LIMIT 1',
      [cleanId]
    );
    if (result.rows.length === 0) return null;
    return mapBookRow(result.rows[0]);
  }

  return localBookRegistrations.find(
    (r) => String(r.studentId).toLowerCase() === cleanId.toLowerCase()
  ) || null;
}

async function createBookRegistration({
  fullName,
  studentId,
  gsuitEmail,
  personalEmail,
  whatsapp,
  paymentMethod,
  senderBkashNumber
}) {
  const cleanStudentId = String(studentId || '').trim();
  const cleanFullName = String(fullName || '').trim();
  const cleanGsuitEmail = String(gsuitEmail || '').trim();
  let cleanPersonalEmail = sanitizePersonalEmail(personalEmail);
  const cleanWhatsapp = String(whatsapp || '').trim();
  const cleanPaymentMethod = String(paymentMethod || '').trim().toLowerCase();
  const cleanSenderBkash = cleanPaymentMethod === 'bkash'
    ? String(senderBkashNumber || '').trim()
    : '';

  const existing = await findBookRegistrationByStudentId(cleanStudentId);
  if (existing) {
    const err = new Error('DUPLICATE_BOOK_REGISTRATION');
    err.code = 'DUPLICATE_BOOK_REGISTRATION';
    throw err;
  }

  const isParticipant = await isCompetitionParticipant(cleanStudentId);
  const amountTk = resolveAmount(isParticipant);

  const { isNeonConnected, pool, dbError } = await getDbContext();

  if (!isNeonConnected) {
    requireNeonOrLocalDev();
  }

  if (isNeonConnected && pool) {
    if (!cleanPersonalEmail) {
      cleanPersonalEmail = await lookupRegistrationPersonalEmail(
        pool,
        cleanStudentId,
        cleanGsuitEmail
      );
    }

    const insertQuery = `
      INSERT INTO book_registrations (
        student_id, full_name, gsuit_email, personal_email, whatsapp,
        is_participant, amount_tk, payment_method, txn_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const values = [
      cleanStudentId,
      cleanFullName,
      cleanGsuitEmail,
      cleanPersonalEmail,
      cleanWhatsapp,
      isParticipant,
      amountTk,
      cleanPaymentMethod,
      cleanSenderBkash || null
    ];
    const result = await pool.query(insertQuery, values);
    return {
      registration: mapBookRow(result.rows[0]),
      storageType: 'Neon PostgreSQL'
    };
  }

  const newReg = {
    id: localBookIdSeq++,
    studentId: cleanStudentId,
    fullName: cleanFullName,
    gsuitEmail: cleanGsuitEmail,
    whatsapp: cleanWhatsapp,
    isParticipant,
    amountTk,
    paymentMethod: cleanPaymentMethod,
    senderBkashNumber: cleanSenderBkash,
    personalEmail: cleanPersonalEmail,
    gender: '',
    handoverStatus: 'pending',
    createdAt: new Date().toISOString()
  };
  localBookRegistrations.push(newReg);

  return {
    registration: newReg,
    storageType: 'Local Memory Fallback (Setup DATABASE_URL for Neon)'
  };
}

async function getAllBookRegistrations() {
  const { isNeonConnected, pool, dbError } = await getDbContext();

  if (isNeonConnected && pool) {
    await backfillBookPersonalEmails(pool);

    const result = await pool.query(`
      SELECT
        b.id,
        b.student_id,
        b.full_name,
        b.gsuit_email,
        b.whatsapp,
        b.is_participant,
        b.amount_tk,
        b.payment_method,
        b.txn_id,
        b.handover_status,
        b.created_at,
        COALESCE(
          NULLIF(TRIM(b.personal_email), ''),
          NULLIF(TRIM(r.personal_email), ''),
          ''
        ) AS personal_email,
        COALESCE(NULLIF(TRIM(r.gender), ''), '') AS gender
      FROM book_registrations b
      LEFT JOIN LATERAL (
        SELECT personal_email, gender
        FROM registrations
        WHERE (
            LOWER(TRIM(student_id)) = LOWER(TRIM(b.student_id))
            OR (
              TRIM(b.gsuit_email) <> ''
              AND LOWER(TRIM(gsuit_email)) = LOWER(TRIM(b.gsuit_email))
            )
          )
        ORDER BY
          CASE WHEN LOWER(TRIM(student_id)) = LOWER(TRIM(b.student_id)) THEN 0 ELSE 1 END,
          created_at DESC
        LIMIT 1
      ) r ON TRUE
      ORDER BY b.id DESC
    `);
    const formatted = result.rows.map(mapBookRow);
    return {
      count: formatted.length,
      orders: formatted,
      storageType: 'Neon PostgreSQL'
    };
  }

  requireNeonOrLocalDev();

  return {
    count: localBookRegistrations.length,
    orders: [...localBookRegistrations].reverse(),
    storageType: 'Local Memory Fallback'
  };
}

async function updateBookHandoverStatus(id, handoverStatus) {
  const status = String(handoverStatus || '').trim().toLowerCase();
  if (!HANDOVER_STATUSES.includes(status)) {
    const err = new Error('INVALID_HANDOVER_STATUS');
    err.code = 'INVALID_HANDOVER_STATUS';
    throw err;
  }

  const { isNeonConnected, pool } = await getDbContext();

  if (isNeonConnected && pool) {
    const result = await pool.query(
      `
      UPDATE book_registrations
      SET handover_status = $1
      WHERE id = $2
      RETURNING *
      `,
      [status, id]
    );
    if (result.rows.length === 0) return null;
    return mapBookRow(result.rows[0]);
  }

  const idx = localBookRegistrations.findIndex((p) => p.id === parseInt(id, 10));
  if (idx === -1) return null;
  localBookRegistrations[idx] = {
    ...localBookRegistrations[idx],
    handoverStatus: status
  };
  return localBookRegistrations[idx];
}

async function deleteBookRegistration(id) {
  const { isNeonConnected, pool } = await getDbContext();

  if (isNeonConnected && pool) {
    const result = await pool.query(
      'DELETE FROM book_registrations WHERE id = $1 RETURNING *;',
      [id]
    );
    return result.rows.length > 0;
  }

  const idx = localBookRegistrations.findIndex((p) => p.id === parseInt(id, 10));
  if (idx === -1) return false;
  localBookRegistrations.splice(idx, 1);
  return true;
}

const PURCHASE_PARTICIPATION =
  'Yes, I want to purchase Uswatun Hasanah, and participate';

/**
 * Sync competition registrants who chose purchase-and-participate
 * into book_registrations (one row per student_id).
 * payment_method=cash, amount_tk=150, is_participant=true
 */
async function syncPurchaseIntentsToBook() {
  const { isNeonConnected, pool, dbError } = await getDbContext();

  if (!isNeonConnected || !pool) {
    requireNeonOrLocalDev();
    throw new Error(dbError || 'Database is not connected.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const missing = await client.query(
      `
      SELECT DISTINCT ON (r.student_id)
        r.student_id,
        r.full_name,
        r.gsuit_email,
        r.personal_email,
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
      [PURCHASE_PARTICIPATION]
    );

    const inserted = [];
    for (const row of missing.rows) {
      const result = await client.query(
        `
        INSERT INTO book_registrations (
          student_id, full_name, gsuit_email, personal_email, whatsapp,
          is_participant, amount_tk, payment_method, txn_id
        )
        VALUES ($1, $2, $3, $4, $5, TRUE, $6, 'cash', NULL)
        ON CONFLICT (student_id) DO NOTHING
        RETURNING *
        `,
        [
          row.student_id,
          row.full_name,
          row.gsuit_email,
          sanitizePersonalEmail(row.personal_email),
          row.whatsapp,
          PARTICIPANT_PRICE
        ]
      );
      if (result.rows.length > 0) {
        inserted.push(mapBookRow(result.rows[0]));
      }
    }

    await client.query('COMMIT');
    return {
      found: missing.rows.length,
      insertedCount: inserted.length,
      inserted
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  PARTICIPANT_PRICE,
  REGULAR_PRICE,
  HANDOVER_STATUSES,
  lookupParticipantPricing,
  createBookRegistration,
  getAllBookRegistrations,
  updateBookHandoverStatus,
  deleteBookRegistration,
  findBookRegistrationByStudentId,
  syncPurchaseIntentsToBook
};
