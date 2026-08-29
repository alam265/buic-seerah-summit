const { getAllParticipants } = require('../services/registrationService');
const {
  getEmailConfigStatus,
  sendNotificationToAll
} = require('../services/emailService');

async function handleEmailStatus(req, res) {
  res.json({
    success: true,
    ...getEmailConfigStatus()
  });
}

async function handleSendNotification(req, res) {
  try {
    const status = getEmailConfigStatus();
    if (!status.configured) {
      return res.status(503).json({
        success: false,
        message: 'Email is not configured on the server. Add SMTP_* variables to .env.'
      });
    }

    const { subject, message } = req.body || {};
    if (!subject || !String(subject).trim()) {
      return res.status(400).json({
        success: false,
        message: 'ইমেইলের বিষয় (subject) দিতে হবে।'
      });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({
        success: false,
        message: 'ইমেইলের বার্তা (message) দিতে হবে।'
      });
    }

    const data = await getAllParticipants();
    if (data.participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'কোনো নিবন্ধিত অংশগ্রহণকারী নেই।'
      });
    }

    const result = await sendNotificationToAll(
      data.participants,
      String(subject).trim(),
      String(message).trim()
    );

    res.json({
      success: true,
      message: `${result.sent.length} জনকে ইমেইল পাঠানো হয়েছে।`,
      sentCount: result.sent.length,
      failedCount: result.failed.length,
      skippedCount: result.skipped.length,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped
    });
  } catch (err) {
    console.error('Bulk Email Notification Error:', err);
    res.status(500).json({
      success: false,
      message: 'ইমেইল পাঠাতে সমস্যা হয়েছে: ' + err.message
    });
  }
}

module.exports = {
  handleEmailStatus,
  handleSendNotification
};
