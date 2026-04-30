const express = require('express');
const bcrypt = require('bcryptjs');
const passport = require('../config/passport');
const { query } = require('../config/database');
const { generateToken } = require('../middleware/auth');
const { registerSchema, loginSchema } = require('../utils/validators');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Local Register
router.post('/register', async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const { full_name, email, password, phone } = value;
    const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    await query(
      `INSERT INTO users (id, email, password_hash, full_name, phone, auth_provider, role)
       VALUES (?, ?, ?, ?, ?, 'local', 'guest')`,
      [id, email, password_hash, full_name, phone || null]
    );

    const userResult = await query('SELECT * FROM users WHERE id = ?', [id]);
    const user = userResult.rows[0];
    const token = generateToken(user);
    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      token,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, avatar_url: user.avatar_url },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// Local Login
router.post('/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const { email, password } = value;
    const result = await query('SELECT * FROM users WHERE email = ?', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = result.rows[0];
    if (!user.password_hash) {
      return res.status(401).json({ success: false, message: 'This account uses social login. Please sign in with Google or GitHub.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = generateToken(user);
    
    // Log for debugging
    console.log(`User login successful: ${user.email} (Role: ${user.role})`);

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: { 
        id: user.id, 
        email: user.email, 
        full_name: user.full_name, 
        role: user.role, 
        avatar_url: user.avatar_url 
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// Verify token and role
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login.html?error=oauth_failed' }),
  (req, res) => {
    const token = generateToken(req.user);
    res.redirect(`/auth-callback.html?token=${token}`);
  }
);

// GitHub OAuth
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: '/login.html?error=oauth_failed' }),
  (req, res) => {
    const token = generateToken(req.user);
    res.redirect(`/auth-callback.html?token=${token}`);
  }
);

// Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.json({ success: false, user: null });

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_jwt_secret');
    const result = await query('SELECT id, email, full_name, phone, avatar_url, role, auth_provider FROM users WHERE id = ?', [decoded.id]);
    if (result.rows.length === 0) return res.json({ success: false, user: null });

    res.json({ success: true, user: result.rows[0] });
  } catch {
    res.json({ success: false, user: null });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  const cleanup = () => {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) console.error('Session destroy error:', err);
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Signed out successfully.' });
      });
    } else {
      res.clearCookie('connect.sid');
      res.json({ success: true, message: 'Signed out successfully.' });
    }
  };

  if (req.logout && req.isAuthenticated && req.isAuthenticated()) {
    req.logout((err) => {
      if (err) console.error('Passport logout error:', err);
      cleanup();
    });
  } else {
    cleanup();
  }
});

module.exports = router;

