const { getPool, getDbStatus } = require('../config/db');

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
    seerahReadBefore: row.seerah_read_before,
    engagementSuggestions: row.engagement_suggestions,
    programmeExpectation: row.programme_expectation,
    invitationSource: row.invitation_source,
    uswatunHasanahRead: row.uswatun_hasanah_read,
    uswatunHasanahParticipation: row.uswatun_hasanah_participation,
    createdAt: row.created_at
  };
}

async function registerParticipant({
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
  seerahReadBefore,
  engagementSuggestions,
  programmeExpectation,
  invitationSource,
  uswatunHasanahRead,
  uswatunHasanahParticipation
}) {
  const { isNeonConnected } = getDbStatus();
  const pool = getPool();
  const ticketId = generateTicketId();
  const cleanStudentId = studentId || '';
  const cleanSemester = semester || '';
  const cleanDepartment = department || 'N/A';
  const cleanWhatsapp = whatsapp || '';
  const cleanFacebookLink = facebookLink || null;
  const cleanGsuitEmail = gsuitEmail || '';
  const cleanPersonalEmail = personalEmail || '';
  const cleanGender = gender || '';
  const cleanBkashTxnId = bkashTxnId || '';
  const cleanSeerahReadBefore = seerahReadBefore || null;
  const cleanEngagementSuggestions = engagementSuggestions || null;
  const cleanProgrammeExpectation = programmeExpectation || null;
  const cleanInvitationSource = invitationSource || null;
  const cleanUswatunHasanahRead = uswatunHasanahRead || null;
  const cleanUswatunHasanahParticipation = uswatunHasanahParticipation || null;

  if (isNeonConnected && pool) {
    const insertQuery = `
      INSERT INTO registrations (
        ticket_id, full_name, student_id, semester, department, whatsapp, facebook_link,
        gsuit_email, personal_email, gender, bkash_txn_id,
        seerah_read_before, engagement_suggestions, programme_expectation,
        invitation_source, uswatun_hasanah_read, uswatun_hasanah_participation
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *;
    `;
    const values = [
      ticketId, fullName, cleanStudentId, cleanSemester, cleanDepartment, cleanWhatsapp,
      cleanFacebookLink, cleanGsuitEmail, cleanPersonalEmail, cleanGender, cleanBkashTxnId,
      cleanSeerahReadBefore, cleanEngagementSuggestions, cleanProgrammeExpectation,
      cleanInvitationSource, cleanUswatunHasanahRead, cleanUswatunHasanahParticipation
    ];
    const result = await pool.query(insertQuery, values);

    return {
      registration: mapRegistrationRow(result.rows[0]),
      storageType: 'Neon PostgreSQL'
    };
  }

  const newReg = {
    id: localRegistrations.length + 1,
    ticketId,
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
    seerahReadBefore: cleanSeerahReadBefore,
    engagementSuggestions: cleanEngagementSuggestions,
    programmeExpectation: cleanProgrammeExpectation,
    invitationSource: cleanInvitationSource,
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
  const { isNeonConnected } = getDbStatus();
  const pool = getPool();

  if (isNeonConnected && pool) {
    const result = await pool.query('SELECT * FROM registrations ORDER BY id DESC');
    const formatted = result.rows.map(mapRegistrationRow);
    return {
      count: formatted.length,
      participants: formatted,
      storageType: 'Neon PostgreSQL'
    };
  }

  return {
    count: localRegistrations.length,
    participants: [...localRegistrations].reverse(),
    storageType: 'Local Memory Fallback'
  };
}

async function isQuizParticipant(studentId) {
  const cleanId = String(studentId || '').trim();
  if (!cleanId) return false;

  const { isNeonConnected } = getDbStatus();
  const pool = getPool();

  if (isNeonConnected && pool) {
    const result = await pool.query(
      'SELECT 1 FROM registrations WHERE student_id = $1 LIMIT 1',
      [cleanId]
    );
    return result.rows.length > 0;
  }

  return localRegistrations.some(
    (r) => String(r.studentId).toLowerCase() === cleanId.toLowerCase()
  );
}

async function getRegistrationsCount() {
  const { isNeonConnected } = getDbStatus();
  const pool = getPool();

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
  seerahReadBefore,
  engagementSuggestions,
  programmeExpectation,
  invitationSource,
  uswatunHasanahRead,
  uswatunHasanahParticipation
}) {
  const { isNeonConnected } = getDbStatus();
  const pool = getPool();

  if (isNeonConnected && pool) {
    const updateQuery = `
      UPDATE registrations
      SET full_name = $1, student_id = $2, semester = $3, department = $4, whatsapp = $5,
          facebook_link = $6, gsuit_email = $7, personal_email = $8, gender = $9, bkash_txn_id = $10,
          seerah_read_before = $11, engagement_suggestions = $12, programme_expectation = $13,
          invitation_source = $14, uswatun_hasanah_read = $15, uswatun_hasanah_participation = $16
      WHERE id = $17
      RETURNING *;
    `;
    const values = [
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
      seerahReadBefore || null,
      engagementSuggestions || null,
      programmeExpectation || null,
      invitationSource || null,
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
    seerahReadBefore: seerahReadBefore || null,
    engagementSuggestions: engagementSuggestions || null,
    programmeExpectation: programmeExpectation || null,
    invitationSource: invitationSource || null,
    uswatunHasanahRead: uswatunHasanahRead || null,
    uswatunHasanahParticipation: uswatunHasanahParticipation || null
  };
  return localRegistrations[idx];
}

async function deleteParticipant(id) {
  const { isNeonConnected } = getDbStatus();
  const pool = getPool();

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
  registerParticipant,
  getAllParticipants,
  getRegistrationsCount,
  isQuizParticipant,
  updateParticipant,
  deleteParticipant
};
