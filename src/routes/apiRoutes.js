const express = require('express');
const router = express.Router();

const { handleRegister, handleGetParticipants, handleUpdateParticipant, handleDeleteParticipant } = require('../controllers/registrationController');
const { handleHealthCheck } = require('../controllers/healthController');
const { handleAdminLogin, handleAdminLogout, handleGetAdminStatus } = require('../controllers/authController');
const { handleEmailStatus, handleSendNotification } = require('../controllers/notificationController');
const { requireAdminAuth } = require('../middlewares/authMiddleware');

// Public API Routes
router.get('/health', handleHealthCheck);
router.post('/register', handleRegister);

// Admin Auth Routes
router.post('/admin/login', handleAdminLogin);
router.post('/admin/logout', handleAdminLogout);
router.get('/admin/me', requireAdminAuth, handleGetAdminStatus);

// Protected Admin API Routes (Only logged in admin can view, edit, delete registrations)
router.get('/participants', requireAdminAuth, handleGetParticipants);
router.put('/participants/:id', requireAdminAuth, handleUpdateParticipant);
router.delete('/participants/:id', requireAdminAuth, handleDeleteParticipant);
router.get('/notifications/email/status', requireAdminAuth, handleEmailStatus);
router.post('/notifications/email/send', requireAdminAuth, handleSendNotification);

module.exports = router;
