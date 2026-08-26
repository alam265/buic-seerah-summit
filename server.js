const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { initDatabase } = require('./src/config/db');
const apiRoutes = require('./src/routes/apiRoutes');
const pageRoutes = require('./src/routes/pageRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from src/views (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'src', 'views')));

// Mount routers
app.use('/api', apiRoutes);
app.use('/', pageRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ success: false, message: 'Internal Server Error: ' + err.message });
});

// Initialize DB and Boot Express Server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 BUIC Quiz Portal Server running at http://localhost:${PORT}`);
  });
});
// Connected with Neon PostgreSQL Database

