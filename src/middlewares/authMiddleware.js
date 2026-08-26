const { verifyAdminToken } = require('../services/authService');

function requireAdminAuth(req, res, next) {
  let token = req.cookies ? req.cookies.admin_token : null;

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'অনুমতি নেই! প্রথমে অ্যাডমিন হিসেবে লগইন করুন।'
    });
  }

  const decoded = verifyAdminToken(token);
  if (!decoded) {
    return res.status(401).json({
      success: false,
      message: 'আপনার সেশন ম্যাথ উত্তীর্ণ হয়েছে, অনুগ্রহ করে পুনরায় লগইন করুন।'
    });
  }

  req.admin = decoded;
  next();
}

function requireAdminPageAccess(req, res, next) {
  const token = req.cookies ? req.cookies.admin_token : null;
  const decoded = token ? verifyAdminToken(token) : null;

  if (!decoded) {
    return res.redirect('/login');
  }

  req.admin = decoded;
  next();
}

function redirectIfAlreadyLoggedIn(req, res, next) {
  const token = req.cookies ? req.cookies.admin_token : null;
  const decoded = token ? verifyAdminToken(token) : null;

  if (decoded) {
    return res.redirect('/admin');
  }

  next();
}

module.exports = {
  requireAdminAuth,
  requireAdminPageAccess,
  redirectIfAlreadyLoggedIn
};
