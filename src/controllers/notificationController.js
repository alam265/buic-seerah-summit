const { getAllParticipants } = require('../services/registrationService');
const { getAllBookRegistrations } = require('../services/bookRegistrationService');
const {
  getEmailConfigStatus,
  sendNotificationToAll
} = require('../services/emailService');

function mapBookRecipients(orders) {
  return (orders || []).map((order) => ({
    id: order.id,
    fullName: order.fullName,
    studentId: order.studentId,
    gsuitEmail: order.gsuitEmail,
    personalEmail: order.personalEmail,
    whatsapp: order.whatsapp,
    amountTk: order.amountTk,
    paymentMethod: order.paymentMethod === 'bkash' ? 'bKash' : 'Cash',
    isParticipant: order.isParticipant ? 'Yes' : 'No'
  }));
}

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
        message: 'An email subject is required.'
      });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({
        success: false,
        message: 'An email message is required.'
      });
    }

    const data = await getAllParticipants();
    if (data.participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'There are no registered participants.'
      });
    }

    const result = await sendNotificationToAll(
      data.participants,
      String(subject).trim(),
      String(message).trim()
    );

    res.json({
      success: true,
      message: `Email sent to ${result.sent.length} recipient(s).`,
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
      message: 'There was a problem sending the email: ' + err.message
    });
  }
}

async function handleSendBookNotification(req, res) {
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
        message: 'An email subject is required.'
      });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({
        success: false,
        message: 'An email message is required.'
      });
    }

    const data = await getAllBookRegistrations();
    if (data.orders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'There are no book registrations.'
      });
    }

    const result = await sendNotificationToAll(
      mapBookRecipients(data.orders),
      String(subject).trim(),
      String(message).trim()
    );

    res.json({
      success: true,
      message: `Email sent to ${result.sent.length} book buyer(s).`,
      sentCount: result.sent.length,
      failedCount: result.failed.length,
      skippedCount: result.skipped.length,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped
    });
  } catch (err) {
    console.error('Book Email Notification Error:', err);
    res.status(500).json({
      success: false,
      message: 'There was a problem sending the email: ' + err.message
    });
  }
}

module.exports = {
  handleEmailStatus,
  handleSendNotification,
  handleSendBookNotification
};
