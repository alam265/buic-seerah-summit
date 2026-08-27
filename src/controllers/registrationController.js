const { registerParticipant, getAllParticipants, updateParticipant, deleteParticipant } = require('../services/registrationService');

const INVITATION_SOURCES = [
  'Deeni Halaqa BRACUians (Messenger GC)',
  'Student community/Faculty Review group',
  'Through Friends',
  'BRACUian Islamic Community page',
  'Deeni Halaqa BRACUians Sisters (Messenger GC)'
];

const USWATUN_PARTICIPATION_OPTIONS = [
  'Yes, I want to purchase Uswatun Hasanah, and participate',
  'I have this already and want to participate without purchasing it'
];

function validateSurveyFields(body) {
  const {
    invitationSource,
    uswatunHasanahRead,
    uswatunHasanahParticipation
  } = body;

  if (!invitationSource || !INVITATION_SOURCES.includes(invitationSource)) {
    return 'অনুগ্রহ করে আমন্ত্রণের উৎস নির্বাচন করুন।';
  }

  if (!uswatunHasanahRead || !['Yes', 'No'].includes(uswatunHasanahRead)) {
    return 'অনুগ্রহ করে Uswatun Hasanah পড়েছেন কিনা (Yes/No) নির্বাচন করুন।';
  }

  if (!uswatunHasanahParticipation || !USWATUN_PARTICIPATION_OPTIONS.includes(uswatunHasanahParticipation)) {
    return 'অনুগ্রহ করে Uswatun Hasanah-এর সাথে প্রতিযোগিতায় অংশগ্রহণের পছন্দ নির্বাচন করুন।';
  }

  return null;
}

async function handleRegister(req, res) {
  try {
    const {
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
    } = req.body;

    if (!fullName || !studentId || !department || !whatsapp || !gsuitEmail || !personalEmail || !gender) {
      return res.status(400).json({
        success: false,
        message: 'অনুগ্রহ করে পূর্ণ নাম, স্টুডেন্ট আইডি, ডিপার্টমেন্ট, হোয়াটসঅ্যাপ, জিসুইট ও পার্সোনাল ইমেইল এবং লিঙ্গ সঠিকভাবে পূরণ করুন।'
      });
    }

    const surveyError = validateSurveyFields(req.body);
    if (surveyError) {
      return res.status(400).json({ success: false, message: surveyError });
    }

    const { registration, storageType } = await registerParticipant({
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
    });

    const isNeon = storageType.includes('Neon');

    return res.status(201).json({
      success: true,
      message: isNeon
        ? 'অভিনন্দন! আপনার রেজিস্ট্রেশান সফলভাবে সম্পন্ন হয়েছে।'
        : 'রেজিস্ট্রেশান সফল হয়েছে।',
      registration,
      storageType
    });
  } catch (err) {
    console.error('Registration Controller Error:', err);
    res.status(500).json({
      success: false,
      message: 'রেজিস্ট্রেশান প্রক্রিয়াজাতকণে সমস্যা হয়েছে: ' + err.message
    });
  }
}

async function handleGetParticipants(req, res) {
  try {
    const data = await getAllParticipants();
    res.json({
      success: true,
      count: data.count,
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
        message: 'ডাটাবেজ এখনও প্রস্তুত নয়। কিছুক্ষণ পর আবার চেষ্টা করুন।'
      });
    }
    res.status(500).json({
      success: false,
      message: 'ডাটা সংগ্রহ করতে ব্যর্থ হয়েছে: ' + err.message
    });
  }
}

async function handleUpdateParticipant(req, res) {
  try {
    const { id } = req.params;
    const {
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
    } = req.body;

    const updated = await updateParticipant(id, {
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
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'অংশগ্রহণকারী খুঁজে পাওয়া যায়নি।' });
    }

    res.json({ success: true, message: 'তথ্য সফলভাবে আপডেট করা হয়েছে।', participant: updated });
  } catch (err) {
    console.error('Update Controller Error:', err);
    res.status(500).json({ success: false, message: 'আপডেট করতে ব্যর্থ হয়েছে: ' + err.message });
  }
}

async function handleDeleteParticipant(req, res) {
  try {
    const { id } = req.params;
    const deleted = await deleteParticipant(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'অংশগ্রহণকারী খুঁজে পাওয়া যায়নি।' });
    }

    res.json({ success: true, message: 'ডাটা সফলভাবে ডিলিট করা হয়েছে।' });
  } catch (err) {
    console.error('Delete Controller Error:', err);
    res.status(500).json({ success: false, message: 'ডিলিট করতে ব্যর্থ হয়েছে: ' + err.message });
  }
}

module.exports = {
  handleRegister,
  handleGetParticipants,
  handleUpdateParticipant,
  handleDeleteParticipant
};
