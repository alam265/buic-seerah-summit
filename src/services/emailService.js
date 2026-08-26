const nodemailer = require('nodemailer');

const PLACEHOLDERS = ['fullName', 'ticketId', 'studentId', 'department', 'semester'];

function isEmailConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

function getEmailConfigStatus() {
  return {
    configured: isEmailConfigured(),
    host: process.env.SMTP_HOST || null,
    from: process.env.SMTP_FROM || process.env.SMTP_USER || null
  };
}

function createTransporter() {
  if (!isEmailConfigured()) {
    throw new Error(
      'Email is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in .env'
    );
  }

  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function getParticipantEmail(participant) {
  const personal = (participant.personalEmail || '').trim();
  const gsuit = (participant.gsuitEmail || '').trim();
  return personal || gsuit || null;
}

function personalizeTemplate(template, participant) {
  if (!template) return '';

  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (!PLACEHOLDERS.includes(key)) return match;
    return participant[key] != null ? String(participant[key]) : '';
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendNotificationToParticipant(transporter, participant, subject, body) {
  const to = getParticipantEmail(participant);
  if (!to) {
    throw new Error(`No email address for ${participant.fullName || 'participant'}`);
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const personalizedSubject = personalizeTemplate(subject, participant);
  const personalizedBody = personalizeTemplate(body, participant);

  await transporter.sendMail({
    from,
    to,
    subject: personalizedSubject,
    text: personalizedBody,
    html: personalizedBody.replace(/\n/g, '<br>')
  });

  return to;
}

async function sendNotificationToAll(participants, subject, body) {
  if (!subject || !subject.trim()) {
    throw new Error('Email subject is required');
  }
  if (!body || !body.trim()) {
    throw new Error('Email message is required');
  }

  const transporter = createTransporter();
  const sent = [];
  const failed = [];

  for (const participant of participants) {
    try {
      const email = await sendNotificationToParticipant(transporter, participant, subject, body);
      sent.push({
        id: participant.id,
        fullName: participant.fullName,
        email
      });
    } catch (err) {
      failed.push({
        id: participant.id,
        fullName: participant.fullName,
        error: err.message
      });
    }

    await delay(150);
  }

  return { sent, failed };
}

module.exports = {
  isEmailConfigured,
  getEmailConfigStatus,
  sendNotificationToAll,
  personalizeTemplate,
  getParticipantEmail
};
