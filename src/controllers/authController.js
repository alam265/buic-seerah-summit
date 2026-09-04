const { authenticateAdmin, generateAdminToken } = require('../services/authService');

async function handleAdminLogin(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'ইউজারনেম এবং পাসওয়ার্ড উভয়ই প্রদান করা আবশ্যক।'
      });
    }

    const admin = await authenticateAdmin(username, password);
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'ভুল ইউজারনেম অথবা পাসওয়ার্ড! আবার চেষ্টা করুন।'
      });
    }

    const token = generateAdminToken(admin);

    // Set cookie for browser session
    const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: isProduction,
      maxAge: 2 * 60 * 60 * 1000, // 2 hours
      sameSite: 'lax'
    });

    return res.json({
      success: true,
      message: 'লগইন সফল হয়েছে! অ্যাডমিন প্যানেলে রিডাইরেক্ট করা হচ্ছে...',
      token,
      redirectUrl: '/admin',
      admin: { username: admin.username }
    });

  } catch (err) {
    console.error('Login controller error:', err);
    res.status(500).json({
      success: false,
      message: 'লগইন করতে সমস্যা হয়েছে: ' + err.message
    });
  }
}

async function handleAdminLogout(req, res) {
  res.clearCookie('admin_token');
  return res.json({
    success: true,
    message: 'Logout successful.',
    redirectUrl: '/login'
  });
}

async function handleGetAdminStatus(req, res) {
  if (req.admin) {
    return res.json({
      success: true,
      isLoggedIn: true,
      admin: req.admin
    });
  }
  return res.json({
    success: true,
    isLoggedIn: false
  });
}

module.exports = {
  handleAdminLogin,
  handleAdminLogout,
  handleGetAdminStatus
};
