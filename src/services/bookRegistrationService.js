const { getDbContext, requireNeonOrLocalDev } = require('../config/db');
const { isQuizParticipant } = require('./registrationService');

const PARTICIPANT_PRICE = 150;
const REGULAR_PRICE = 220;

const localBookRegistrations = [];
let localBookIdSeq = 1;

function mapBookRow(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    fullName: row.full_name,
    gsuitEmail: row.gsuit_email,
    whatsapp: row.whatsapp,
    isParticipant: Boolean(row.is_participant),
    amountTk: row.amount_tk,
    paymentMethod: row.payment_method,
    senderBkashNumber: row.txn_id || '',
    createdAt: row.created_at
  };
}

function resolveAmount(isParticipant) {
  return isParticipant ? PARTICIPANT_PRICE : REGULAR_PRICE;
}

async function lookupParticipantPricing(studentId) {
  const isParticipant = await isQuizParticipant(studentId);
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
      'SELECT * FROM book_registrations WHERE student_id = $1 LIMIT 1',
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
  whatsapp,
  paymentMethod,
  senderBkashNumber
}) {
  const cleanStudentId = String(studentId || '').trim();
  const cleanFullName = String(fullName || '').trim();
  const cleanGsuitEmail = String(gsuitEmail || '').trim();
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

  const isParticipant = await isQuizParticipant(cleanStudentId);
  const amountTk = resolveAmount(isParticipant);

  const { isNeonConnected, pool, dbError } = await getDbContext();

  if (!isNeonConnected) {
    requireNeonOrLocalDev();
  }

  if (isNeonConnected && pool) {
    const insertQuery = `
      INSERT INTO book_registrations (
        student_id, full_name, gsuit_email, whatsapp,
        is_participant, amount_tk, payment_method, txn_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [
      cleanStudentId,
      cleanFullName,
      cleanGsuitEmail,
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
    const result = await pool.query('SELECT * FROM book_registrations ORDER BY id DESC');
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

module.exports = {
  PARTICIPANT_PRICE,
  REGULAR_PRICE,
  lookupParticipantPricing,
  createBookRegistration,
  getAllBookRegistrations,
  deleteBookRegistration,
  findBookRegistrationByStudentId
};
