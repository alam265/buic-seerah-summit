const { getDbContext, requireNeonOrLocalDev } = require('../config/db');

const COMPETITION_TYPES = ['quiz', 'seerah'];
const localRegistrations = [];

function generateTicketId() {
  const prefix = 'BUIC-2026-';
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}${randomNum}`;
}

function mapRegistrationRow(row) {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    competition: row.competition,
    fullName: row.full_name,
    studentId: row.student_id,
    semester: row.semester,
    department: row.department,
    whatsapp: row.whatsapp,
    facebookLink: row.facebook_link,
    gsuitEmail: row.gsuit_email,
    personalEmail: row.personal_email,
    gender: row.gender,
    bkashTxnId: row.bkash_txn_id,
    uswatunHasanahRead: row.uswatun_hasanah_read,
    uswatunHasanahParticipation: row.uswatun_hasanah_participation,
    createdAt: row.created_at
  };
}

function createDuplicateRegistrationError() {
  const err = new Error('DUPLICATE_REGISTRATION');
  err.code = 'DUPLICATE_REGISTRATION';
  return err;
}

async function registerParticipant({
  competition,
  fullName,
  studentId,
  semester,
  department,
  whatsapp,
  facebookLink,
  gsuitEmail,
  personalEmail,
  gender,
  bkashTxnId,
  uswatunHasanahRead,
  uswatunHasanahParticipation
}) {
  const { isNeonConnected, pool } = await getDbContext();
  const ticketId = generateTicketId();
  const cleanCompetition = competition || 'quiz';
  const cleanStudentId = studentId || '';
  const cleanSemester = semester || '';
  const cleanDepartment = department || 'N/A';
  const cleanWhatsapp = whatsapp || '';
  const cleanFacebookLink = facebookLink || null;
  const cleanGsuitEmail = gsuitEmail || '';
  const cleanPersonalEmail = personalEmail || '';
  const cleanGender = gender || '';
  const cleanBkashTxnId = bkashTxnId || '';
  const cleanUswatunHasanahRead = uswatunHasanahRead || null;
  const cleanUswatunHasanahParticipation = uswatunHasanahParticipation || null;

  if (!isNeonConnected) {
    requireNeonOrLocalDev();
  }

  if (isNeonConnected && pool) {
    const existing = await pool.query(
      'SELECT 1 FROM registrations WHERE student_id = $1 AND competition = $2 LIMIT 1',
      [cleanStudentId, cleanCompetition]
    );
    if (existing.rows.length > 0) {
      throw createDuplicateRegistrationError();
    }

    const insertQuery = `
      INSERT INTO registrations (
        ticket_id, competition, full_name, student_id, semester, department, whatsapp, facebook_link,
        gsuit_email, personal_email, gender, bkash_txn_id,
        uswatun_hasanah_read, uswatun_hasanah_participation
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *;
    `;
    const values = [
      ticketId, cleanCompetition, fullName, cleanStudentId, cleanSemester, cleanDepartment, cleanWhatsapp,
      cleanFacebookLink, cleanGsuitEmail, cleanPersonalEmail, cleanGender, cleanBkashTxnId,
      cleanUswatunHasanahRead, cleanUswatunHasanahParticipation
    ];

    try {
      const result = await pool.query(insertQuery, values);
      return {
        registration: mapRegistrationRow(result.rows[0]),
        storageType: 'Neon PostgreSQL'
      };
    } catch (err) {
      if (err.code === '23505') {
        throw createDuplicateRegistrationError();
      }
      throw err;
    }
  }

  const duplicate = localRegistrations.some(
    (r) => String(r.studentId).toLowerCase() === cleanStudentId.toLowerCase()
      && r.competition === cleanCompetition
  );
  if (duplicate) {
    throw createDuplicateRegistrationError();
  }

  const newReg = {
    id: localRegistrations.length + 1,
    ticketId,
    competition: cleanCompetition,
    fullName,
    studentId: cleanStudentId,
    semester: cleanSemester,
    department: cleanDepartment,
    whatsapp: cleanWhatsapp,
    facebookLink: cleanFacebookLink,
    gsuitEmail: cleanGsuitEmail,
    personalEmail: cleanPersonalEmail,
    gender: cleanGender,
    bkashTxnId: cleanBkashTxnId,
    uswatunHasanahRead: cleanUswatunHasanahRead,
    uswatunHasanahParticipation: cleanUswatunHasanahParticipation,
    createdAt: new Date().toISOString()
  };
  localRegistrations.push(newReg);

  return {
    registration: newReg,
    storageType: 'Local Memory Fallback (Setup DATABASE_URL for Neon)'
  };
}

async function getAllParticipants() {
  const { isNeonConnected, pool } = await getDbContext();

  if (isNeonConnected && pool) {
    const result = await pool.query('SELECT * FROM registrations ORDER BY id DESC');
    const formatted = result.rows.map(mapRegistrationRow);
    return {
      count: formatted.length,
      participants: formatted,
      storageType: 'Neon PostgreSQL'
    };
  }

  requireNeonOrLocalDev();

  return {
    count: localRegistrations.length,
    participants: [...localRegistrations].reverse(),
    storageType: 'Local Memory Fallback'
  };
}

async function isCompetitionParticipant(studentId) {
  const cleanId = String(studentId || '').trim();
  if (!cleanId) return false;

  const { isNeonConnected, pool } = await getDbContext();

  if (isNeonConnected && pool) {
    const result = await pool.query(
      "SELECT 1 FROM registrations WHERE student_id = $1 AND competition IN ('quiz', 'seerah') LIMIT 1",
      [cleanId]
    );
    return result.rows.length > 0;
  }

  return localRegistrations.some(
    (r) => String(r.studentId).toLowerCase() === cleanId.toLowerCase()
      && (r.competition === 'quiz' || r.competition === 'seerah')
  );
}

async function getRegistrationsCount() {
  const { isNeonConnected, pool } = await getDbContext();

  if (isNeonConnected && pool) {
    try {
      const result = await pool.query('SELECT COUNT(*) FROM registrations');
      return parseInt(result.rows[0].count, 10);
    } catch (e) {
      console.error('Error counting registrations:', e);
      return 0;
    }
  }

  return localRegistrations.length;
}

async function updateParticipant(id, {
  competition,
  fullName,
  studentId,
  semester,
  department,
  whatsapp,
  facebookLink,
  gsuitEmail,
  personalEmail,
  gender,
  bkashTxnId,
  uswatunHasanahRead,
  uswatunHasanahParticipation
}) {
  const { isNeonConnected, pool } = await getDbContext();

  if (isNeonConnected && pool) {
    const updateQuery = `
      UPDATE registrations
      SET competition = $1, full_name = $2, student_id = $3, semester = $4, department = $5, whatsapp = $6,
          facebook_link = $7, gsuit_email = $8, personal_email = $9, gender = $10, bkash_txn_id = $11,
          uswatun_hasanah_read = $12, uswatun_hasanah_participation = $13
      WHERE id = $14
      RETURNING *;
    `;
    const values = [
      competition || 'quiz',
      fullName,
      studentId || '',
      semester || '',
      department || 'N/A',
      whatsapp || '',
      facebookLink || null,
      gsuitEmail || '',
      personalEmail || '',
      gender || '',
      bkashTxnId || '',
      uswatunHasanahRead || null,
      uswatunHasanahParticipation || null,
      id
    ];
    const result = await pool.query(updateQuery, values);
    if (result.rows.length === 0) return null;
    return mapRegistrationRow(result.rows[0]);
  }

  const idx = localRegistrations.findIndex(p => p.id === parseInt(id, 10));
  if (idx === -1) return null;
  localRegistrations[idx] = {
    ...localRegistrations[idx],
    competition: competition || 'quiz',
    fullName,
    studentId: studentId || '',
    semester: semester || '',
    department: department || 'N/A',
    whatsapp: whatsapp || '',
    facebookLink: facebookLink || null,
    gsuitEmail: gsuitEmail || '',
    personalEmail: personalEmail || '',
    gender: gender || '',
    bkashTxnId: bkashTxnId || '',
    uswatunHasanahRead: uswatunHasanahRead || null,
    uswatunHasanahParticipation: uswatunHasanahParticipation || null
  };
  return localRegistrations[idx];
}

async function deleteParticipant(id) {
  const { isNeonConnected, pool } = await getDbContext();

  if (isNeonConnected && pool) {
    const deleteQuery = 'DELETE FROM registrations WHERE id = $1 RETURNING *;';
    const result = await pool.query(deleteQuery, [id]);
    return result.rows.length > 0;
  }

  const idx = localRegistrations.findIndex(p => p.id === parseInt(id, 10));
  if (idx === -1) return false;
  localRegistrations.splice(idx, 1);
  return true;
}

module.exports = {
  COMPETITION_TYPES,
  registerParticipant,
  getAllParticipants,
  getRegistrationsCount,
  isCompetitionParticipant,
  updateParticipant,
  deleteParticipant
};
