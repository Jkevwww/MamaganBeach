require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const passport = require('./config/passport');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for secure cookies on Render/Heroku
app.set('trust proxy', 1);

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

app.use(limiter);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://unpkg.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https://api.paymongo.com"],
    },
  },
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session for OAuth
const MySQLStore = require('express-mysql-session')(session);
const { pool } = require('./config/database');
const sessionStore = new MySQLStore({}, pool);

app.use(session({
  secret: process.env.SESSION_SECRET || 'default_session_secret',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

app.use(passport.initialize());
app.use(passport.session());

// Block mobile devices (Android/iOS)
app.use((req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  if (mobileRegex.test(userAgent)) {
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Exclusive Desktop Experience | Mamagan Beach Resort</title>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@300;600&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; background-color: #fcfaf7; color: #0c1b33; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
          .container { max-width: 400px; padding: 40px; }
          h1 { font-family: 'Playfair Display', serif; font-size: 2.5rem; margin-bottom: 20px; }
          p { line-height: 1.6; color: rgba(12, 27, 51, 0.6); margin-bottom: 30px; font-size: 0.9rem; }
          .icon { font-size: 4rem; margin-bottom: 20px; color: #c5a059; }
          .btn { display: inline-block; padding: 15px 30px; background-color: #0c1b33; color: #fff; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.2em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">🖥️</div>
          <h1>Desktop Exclusive</h1>
          <p>The Mamagan Beach Resort premium booking suite is optimized for high-resolution desktop displays to ensure the highest level of service and detail.</p>
          <p>Please return using a workstation or laptop to continue your journey.</p>
          <div style="font-size: 0.6rem; color: #c5a059; font-weight: 800; letter-spacing: 0.3em; text-transform: uppercase;">Where luxury meets the horizon</div>
        </div>
      </body>
      </html>
    `);
  }
  next();
});

// Static files

app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/resorts', require('./routes/resorts'));
app.use('/api/facilities', require('./routes/facilities'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/admin', require('./routes/admin'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Mamagan Beach Resort API is running.' });
});

// Fallback: serve index.html for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Mamagan Beach Resort server running on port ${PORT}`);
  console.log(`API: http://localhost:${PORT}/api`);
});
