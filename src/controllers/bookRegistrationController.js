const {
  lookupParticipantPricing,
  createBookRegistration,
  getAllBookRegistrations,
  deleteBookRegistration,
  findBookRegistrationByStudentId
} = require('../services/bookRegistrationService');

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

async function handleBookLookup(req, res) {
  try {
    const { studentId, fullName, gsuitEmail, whatsapp } = req.body;

    if (!studentId || !fullName || !gsuitEmail || !whatsapp) {
      return res.status(400).json({
        success: false,
        message: 'অনুগ্রহ করে স্টুডেন্ট আইডি, নাম, জিসুইট ইমেইল এবং হোয়াটসঅ্যাপ পূরণ করুন।'
      });
    }

    const existing = await findBookRegistrationByStudentId(studentId);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'এই স্টুডেন্ট আইডি দিয়ে ইতিমধ্যে বই রেজিস্ট্রেশন সম্পন্ন হয়েছে।'
      });
    }

    const pricing = await lookupParticipantPricing(studentId);
    const message = pricing.isParticipant
      ? 'Congratulations! You got a discount as you are a participant of the Quiz.'
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
      message: 'লুকআপ করতে সমস্যা হয়েছে: ' + err.message
    });
  }
}

async function handleBookRegister(req, res) {
  try {
    const {
      studentId,
      fullName,
      gsuitEmail,
      whatsapp,
      paymentMethod,
      senderBkashNumber
    } = req.body;

    if (!studentId || !fullName || !gsuitEmail || !whatsapp || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'অনুগ্রহ করে সকল প্রয়োজনীয় ঘর সঠিকভাবে পূরণ করুন।'
      });
    }

    const method = String(paymentMethod).trim().toLowerCase();
    if (!PAYMENT_METHODS.includes(method)) {
      return res.status(400).json({
        success: false,
        message: 'পেমেন্ট মেথড Cash অথবা bKash নির্বাচন করুন।'
      });
    }

    if (method === 'bkash' && !String(senderBkashNumber || '').trim()) {
      return res.status(400).json({
        success: false,
        message: 'bKash দিয়ে পেমেন্ট করলে যে নম্বর থেকে পাঠিয়েছেন সেটি দিতে হবে।'
      });
    }

    const { registration, storageType } = await createBookRegistration({
      studentId,
      fullName,
      gsuitEmail,
      whatsapp,
      paymentMethod: method,
      senderBkashNumber
    });

    return res.status(201).json({
      success: true,
      message: 'বই রেজিস্ট্রেশন সফলভাবে সম্পন্ন হয়েছে!',
      registration,
      storageType
    });
  } catch (err) {
    if (err.code === 'DUPLICATE_BOOK_REGISTRATION' || err.message === 'DUPLICATE_BOOK_REGISTRATION') {
      return res.status(409).json({
        success: false,
        message: 'এই স্টুডেন্ট আইডি দিয়ে ইতিমধ্যে বই রেজিস্ট্রেশন সম্পন্ন হয়েছে।'
      });
    }

    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'এই স্টুডেন্ট আইডি দিয়ে ইতিমধ্যে বই রেজিস্ট্রেশন সম্পন্ন হয়েছে।'
      });
    }

    console.error('Book register error:', err);
    res.status(500).json({
      success: false,
      message: 'বই রেজিস্ট্রেশন প্রক্রিয়াজাতকণে সমস্যা হয়েছে: ' + err.message
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
        message: 'ডাটাবেজ এখনও প্রস্তুত নয়। কিছুক্ষণ পর আবার চেষ্টা করুন।'
      });
    }
    res.status(500).json({
      success: false,
      message: 'বই রেজিস্ট্রেশন তালিকা সংগ্রহ করতে ব্যর্থ: ' + err.message
    });
  }
}

async function handleDeleteBookOrder(req, res) {
  try {
    const { id } = req.params;
    const deleted = await deleteBookRegistration(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'বই রেজিস্ট্রেশন খুঁজে পাওয়া যায়নি।' });
    }
    res.json({ success: true, message: 'বই রেজিস্ট্রেশন সফলভাবে ডিলিট করা হয়েছে।' });
  } catch (err) {
    console.error('Book order delete error:', err);
    res.status(500).json({ success: false, message: 'ডিলিট করতে ব্যর্থ: ' + err.message });
  }
}

module.exports = {
  handleBookConfig,
  handleBookLookup,
  handleBookRegister,
  handleGetBookOrders,
  handleDeleteBookOrder
};
