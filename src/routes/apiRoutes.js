const express = require('express');
const router = express.Router();

const { handleRegister, handleGetParticipants, handleUpdateParticipant, handleDeleteParticipant } = require('../controllers/registrationController');
const {
  handleBookConfig,
  handleBookLookup,
  handleBookRegister,
  handleGetBookOrders,
  handleDeleteBookOrder
} = require('../controllers/bookRegistrationController');
const { handleHealthCheck } = require('../controllers/healthController');
const { handleAdminLogin, handleAdminLogout, handleGetAdminStatus } = require('../controllers/authController');
const { handleEmailStatus, handleSendNotification } = require('../controllers/notificationController');
const { requireAdminAuth } = require('../middlewares/authMiddleware');

// Public API Routes
router.get('/health', handleHealthCheck);
router.post('/register', handleRegister);
router.get('/book-register/config', handleBookConfig);
router.post('/book-register/lookup', handleBookLookup);
router.post('/book-register', handleBookRegister);

// Admin Auth Routes
router.post('/admin/login', handleAdminLogin);
router.post('/admin/logout', handleAdminLogout);
router.get('/admin/me', requireAdminAuth, handleGetAdminStatus);

// Protected Admin API Routes (Only logged in admin can view, edit, delete registrations)
router.get('/participants', requireAdminAuth, handleGetParticipants);
router.put('/participants/:id', requireAdminAuth, handleUpdateParticipant);
router.delete('/participants/:id', requireAdminAuth, handleDeleteParticipant);
router.get('/book-orders', requireAdminAuth, handleGetBookOrders);
router.delete('/book-orders/:id', requireAdminAuth, handleDeleteBookOrder);
router.get('/notifications/email/status', requireAdminAuth, handleEmailStatus);
router.post('/notifications/email/send', requireAdminAuth, handleSendNotification);

module.exports = router;
