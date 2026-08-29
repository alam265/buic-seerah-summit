const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { requireAdminPageAccess, redirectIfAlreadyLoggedIn } = require('../middlewares/authMiddleware');

const viewsPath = path.join(__dirname, '..', 'views');
const partialsPath = path.join(viewsPath, 'partials');

function renderPage(res, pageFileName) {
  try {
    let html = fs.readFileSync(path.join(viewsPath, pageFileName), 'utf8');
    const header = fs.readFileSync(path.join(partialsPath, 'header.html'), 'utf8');
    const footer = fs.readFileSync(path.join(partialsPath, 'footer.html'), 'utf8');

    // Replace header placeholder or navbar tag with header partial
    html = html.replace(/<div id="header-placeholder"><\/div>|<!-- HEADER_SNIPPET -->/gi, header);
    // Replace footer placeholder or footer tag with footer partial
    html = html.replace(/<div id="footer-placeholder"><\/div>|<!-- FOOTER_SNIPPET -->/gi, footer);

    res.send(html);
  } catch (err) {
    console.error(`Error rendering page ${pageFileName}:`, err);
    res.sendFile(path.join(viewsPath, pageFileName));
  }
}

router.get('/', (req, res) => renderPage(res, 'index.html'));
router.get('/about', (req, res) => renderPage(res, 'about.html'));
router.get('/contact', (req, res) => renderPage(res, 'contact-us.html'));
router.get('/register', (req, res) => renderPage(res, 'register.html'));
router.get('/register/seerah', (req, res) => res.redirect('/register?competition=seerah'));
router.get('/book-register', (req, res) => renderPage(res, 'book-register.html'));
router.get('/events/quiz', (req, res) => renderPage(res, 'events-quiz.html'));
router.get('/events/open-book', (req, res) => renderPage(res, 'events-open-book.html'));
router.get('/events/grand-seminar', (req, res) => renderPage(res, 'events-grand-seminar.html'));
router.get('/login', redirectIfAlreadyLoggedIn, (req, res) => renderPage(res, 'login.html'));
router.get('/admin', requireAdminPageAccess, (req, res) => renderPage(res, 'admin.html'));

module.exports = router;
