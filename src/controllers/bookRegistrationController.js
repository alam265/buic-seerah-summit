const {
  lookupParticipantPricing,
  createBookRegistration,
  getAllBookRegistrations,
  updateBookHandoverStatus,
  deleteBookRegistration,
  findBookRegistrationByStudentId,
  syncPurchaseIntentsToBook,
  HANDOVER_STATUSES
} = require('../services/bookRegistrationService');
const { hasCompetitionRegistration } = require('../services/registrationService');

const PAYMENT_METHODS = ['cash', 'bkash'];

function getBkashNumber() {
  return (process.env.BKASH_NUMBER || '').trim();
}

async function handleBookConfig(req, res) {
  try {
    res.json({
      success: true,
      bkashNumber: getBkashNumber(),
      participantPrice: 150,
      regularPrice: 220
    });
  } catch (err) {
    console.error('Book config error:', err);
    res.status(500).json({ success: false, message: 'Config load failed.' });
  }
}

async function handleBookStatus(req, res) {
  try {
    const studentId = String(req.query.studentId || req.body?.studentId || '').trim();
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'Student ID is required.'
      });
    }

    const existing = await findBookRegistrationByStudentId(studentId);
    return res.json({
      success: true,
      alreadyRegistered: Boolean(existing)
    });
  } catch (err) {
    console.error('Book status error:', err);
    res.status(500).json({
      success: false,
      message: 'There was a problem checking the status: ' + err.message
    });
  }
}

async function handleBookLookup(req, res) {
  try {
    const { studentId, fullName, gsuitEmail, personalEmail, whatsapp } = req.body;

    if (!studentId || !fullName || !gsuitEmail || !personalEmail || !whatsapp) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in your student ID, name, GSuite email, personal email, and WhatsApp number.'
      });
    }

    const existing = await findBookRegistrationByStudentId(studentId);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A book registration already exists for this student ID.'
      });
    }

    const pricing = await lookupParticipantPricing(studentId);
    const message = pricing.isParticipant
      ? 'Congratulations! You got a discount as you are a registered Quiz or Open Book participant.'
      : 'Regular book price applies.';

    return res.json({
      success: true,
      isParticipant: pricing.isParticipant,
      amountTk: pricing.amountTk,
      regularPrice: pricing.regularPrice,
      participantPrice: pricing.participantPrice,
      message
    });
  } catch (err) {
    console.error('Book lookup error:', err);
    res.status(500).json({
      success: false,
      message: 'There was a problem with the lookup: ' + err.message
    });
  }
}

async function handleBookRegister(req, res) {
  try {
    const {
      studentId,
      fullName,
      gsuitEmail,
      personalEmail,
      whatsapp,
      paymentMethod,
      senderBkashNumber
    } = req.body;

    if (!studentId || !fullName || !gsuitEmail || !personalEmail || !whatsapp || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields correctly.'
      });
    }

    const method = String(paymentMethod).trim().toLowerCase();
    if (!PAYMENT_METHODS.includes(method)) {
      return res.status(400).json({
        success: false,
        message: 'Please select a payment method: Cash or bKash.'
      });
    }

    if (method === 'bkash' && !String(senderBkashNumber || '').trim()) {
      return res.status(400).json({
        success: false,
        message: 'If paying via bKash, you must provide the number you sent from.'
      });
    }

    const { registration, storageType } = await createBookRegistration({
      studentId,
      fullName,
      gsuitEmail,
      personalEmail,
      whatsapp,
      paymentMethod: method,
      senderBkashNumber
    });

    const missingCompetitions = [];
    if (!(await hasCompetitionRegistration(studentId, 'quiz'))) missingCompetitions.push('quiz');
    if (!(await hasCompetitionRegistration(studentId, 'seerah'))) missingCompetitions.push('seerah');

    return res.status(201).json({
      success: true,
      message: 'Book registration completed successfully!',
      registration,
      storageType,
      missingCompetitions
    });
  } catch (err) {
    if (err.code === 'DUPLICATE_BOOK_REGISTRATION' || err.message === 'DUPLICATE_BOOK_REGISTRATION') {
      return res.status(409).json({
        success: false,
        message: 'A book registration already exists for this student ID.'
      });
    }

    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'A book registration already exists for this student ID.'
      });
    }

    console.error('Book register error:', err);
    res.status(500).json({
      success: false,
      message: 'There was a problem processing the book registration: ' + err.message
    });
  }
}

async function handleGetBookOrders(req, res) {
  try {
    const data = await getAllBookRegistrations();
    res.json({
      success: true,
      count: data.count,
      orders: data.orders,
      storageType: data.storageType
    });
  } catch (err) {
    console.error('Book orders list error:', err);
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
      message: 'Failed to fetch the book registration list: ' + err.message
    });
  }
}

async function handleUpdateBookHandoverStatus(req, res) {
  try {
    const { id } = req.params;
    const { handoverStatus } = req.body || {};
    const status = String(handoverStatus || '').trim().toLowerCase();

    if (!HANDOVER_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Handover status must be pending or received.'
      });
    }

    const order = await updateBookHandoverStatus(id, status);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Book registration not found.' });
    }

    res.json({
      success: true,
      message: 'Handover status updated.',
      order
    });
  } catch (err) {
    if (err.code === 'INVALID_HANDOVER_STATUS') {
      return res.status(400).json({
        success: false,
        message: 'Handover status must be pending or received.'
      });
    }
    console.error('Book handover status update error:', err);
    res.status(500).json({ success: false, message: 'Status update failed: ' + err.message });
  }
}

async function handleDeleteBookOrder(req, res) {
  try {
    const { id } = req.params;
    const deleted = await deleteBookRegistration(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Book registration not found.' });
    }
    res.json({ success: true, message: 'Book registration deleted successfully.' });
  } catch (err) {
    console.error('Book order delete error:', err);
    res.status(500).json({ success: false, message: 'Delete failed: ' + err.message });
  }
}

async function handleSyncPurchaseToBook(req, res) {
  try {
    const result = await syncPurchaseIntentsToBook();
    const message = result.insertedCount === 0
      ? 'Sync complete — no new purchase intents to add.'
      : `Sync complete — added ${result.insertedCount} book registration(s).`;

    res.json({
      success: true,
      message,
      found: result.found,
      insertedCount: result.insertedCount,
      inserted: result.inserted
    });
  } catch (err) {
    console.error('Purchase sync error:', err);
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
      message: 'Sync failed: ' + err.message
    });
  }
}

module.exports = {
  handleBookConfig,
  handleBookStatus,
  handleBookLookup,
  handleBookRegister,
  handleGetBookOrders,
  handleUpdateBookHandoverStatus,
  handleDeleteBookOrder,
  handleSyncPurchaseToBook
};
