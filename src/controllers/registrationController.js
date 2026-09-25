const {
  registerParticipant,
  getAllParticipants,
  updateParticipant,
  deleteParticipant,
  hasCompetitionRegistration,
  COMPETITION_TYPES
} = require('../services/registrationService');
const { findBookRegistrationByStudentId } = require('../services/bookRegistrationService');

const USWATUN_PURCHASE_OPTION = 'Yes, I want to purchase Uswatun Hasanah, and participate';
const USWATUN_ALREADY_HAVE_OPTION = 'I have this already and want to participate without purchasing it';
const USWATUN_PARTICIPATION_OPTIONS = [
  USWATUN_PURCHASE_OPTION,
  USWATUN_ALREADY_HAVE_OPTION
];

function validateUswatunFields(body) {
  const {
    uswatunHasanahRead,
    uswatunHasanahParticipation
  } = body;

  if (!uswatunHasanahRead || !['Yes', 'No'].includes(uswatunHasanahRead)) {
    return 'Please select whether you have read Uswatun Hasanah (Yes/No).';
  }

  if (!uswatunHasanahParticipation || !USWATUN_PARTICIPATION_OPTIONS.includes(uswatunHasanahParticipation)) {
    return 'Please select your Uswatun Hasanah participation choice.';
  }

  return null;
}

async function handleRegister(req, res) {
  try {
    const {
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
    } = req.body;

    const cleanCompetition = competition || 'quiz';
    if (!COMPETITION_TYPES.includes(cleanCompetition)) {
      return res.status(400).json({
        success: false,
        message: 'An invalid competition type was selected.'
      });
    }

    if (!fullName || !studentId || !department || !whatsapp || !facebookLink || !gsuitEmail || !personalEmail || !gender) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in your full name, student ID, department, WhatsApp number, Facebook ID, GSuite and personal email, and gender correctly.'
      });
    }

    const uswatunError = validateUswatunFields(req.body);
    if (uswatunError) {
      return res.status(400).json({ success: false, message: uswatunError });
    }

    let participationChoice = uswatunHasanahParticipation;
    if (participationChoice === USWATUN_PURCHASE_OPTION) {
      const existingBook = await findBookRegistrationByStudentId(studentId);
      if (existingBook) {
        participationChoice = USWATUN_ALREADY_HAVE_OPTION;
      }
    }

    const { registration, storageType } = await registerParticipant({
      competition: cleanCompetition,
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
      uswatunHasanahParticipation: participationChoice
    });

    const isNeon = storageType.includes('Neon');
    const otherCompetition = cleanCompetition === 'quiz' ? 'seerah' : 'quiz';
    const alreadyRegisteredOther = await hasCompetitionRegistration(studentId, otherCompetition);

    return res.status(201).json({
      success: true,
      message: isNeon
        ? 'Congratulations! Your registration was completed successfully.'
        : 'Registration successful.',
      registration,
      storageType,
      otherCompetition,
      alreadyRegisteredOther
    });
  } catch (err) {
    console.error('Registration Controller Error:', err);
    if (err.code === 'DUPLICATE_REGISTRATION') {
      return res.status(409).json({
        success: false,
        message: 'A registration for this competition already exists with this student ID.'
      });
    }
    res.status(500).json({
      success: false,
      message: 'There was a problem processing the registration: ' + err.message
    });
  }
}

async function handleGetParticipants(req, res) {
  try {
    const data = await getAllParticipants();
    res.json({
      success: true,
      count: data.count,
      summary: data.summary,
      participants: data.participants,
      storageType: data.storageType
    });
  } catch (err) {
    console.error('Participants Controller Error:', err);
    if (err.code === 'DB_NOT_READY') {
      return res.status(503).json({
        success: false,
        code: 'DB_NOT_READY',
        retryable: true,
        message: 'The database is not ready yet. Please try again in a moment.'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to fetch data: ' + err.message
    });
  }
}

async function handleUpdateParticipant(req, res) {
  try {
    const { id } = req.params;
    const {
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
    } = req.body;

    const cleanCompetition = competition || 'quiz';
    if (!COMPETITION_TYPES.includes(cleanCompetition)) {
      return res.status(400).json({
        success: false,
        message: 'An invalid competition type was selected.'
      });
    }

    const updated = await updateParticipant(id, {
      competition: cleanCompetition,
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
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Participant not found.' });
    }

    res.json({ success: true, message: 'Data updated successfully.', participant: updated });
  } catch (err) {
    console.error('Update Controller Error:', err);
    res.status(500).json({ success: false, message: 'Update failed: ' + err.message });
  }
}

async function handleDeleteParticipant(req, res) {
  try {
    const { id } = req.params;
    const deleted = await deleteParticipant(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Participant not found.' });
    }

    res.json({ success: true, message: 'Data deleted successfully.' });
  } catch (err) {
    console.error('Delete Controller Error:', err);
    res.status(500).json({ success: false, message: 'Delete failed: ' + err.message });
  }
}

module.exports = {
  handleRegister,
  handleGetParticipants,
  handleUpdateParticipant,
  handleDeleteParticipant
};
