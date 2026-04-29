require('dotenv').config();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const { query } = require('./database');
const { v4: uuidv4 } = require('uuid');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await query('SELECT * FROM users WHERE id = ?', [id]);
    done(null, result.rows[0] || null);
  } catch (err) {
    done(err, null);
  }
});

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL}/api/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const fullName = profile.displayName;
        const avatar = profile.photos[0]?.value;
        const providerId = profile.id;

        let result = await query('SELECT * FROM users WHERE auth_provider = ? AND provider_id = ?', [
          'google',
          providerId,
        ]);

        if (result.rows.length > 0) {
          return done(null, result.rows[0]);
        }

        result = await query('SELECT * FROM users WHERE email = ?', [email]);
        if (result.rows.length > 0) {
          await query(
            'UPDATE users SET auth_provider = ?, provider_id = ?, avatar_url = ? WHERE id = ?',
            ['google', providerId, avatar, result.rows[0].id]
          );
          result = await query('SELECT * FROM users WHERE id = ?', [result.rows[0].id]);
          return done(null, result.rows[0]);
        }

        const id = uuidv4();
        await query(
          `INSERT INTO users (id, email, full_name, avatar_url, auth_provider, provider_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, email, fullName, avatar, 'google', providerId]
        );
        result = await query('SELECT * FROM users WHERE id = ?', [id]);
        done(null, result.rows[0]);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

// GitHub OAuth Strategy
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL}/api/auth/github/callback`,
      scope: ['user:email'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value || `${profile.id}@github.user`;
        const fullName = profile.displayName || profile.username;
        const avatar = profile.photos?.[0]?.value;
        const providerId = profile.id;

        let result = await query('SELECT * FROM users WHERE auth_provider = ? AND provider_id = ?', [
          'github',
          providerId,
        ]);

        if (result.rows.length > 0) {
          return done(null, result.rows[0]);
        }

        result = await query('SELECT * FROM users WHERE email = ?', [email]);
        if (result.rows.length > 0) {
          await query(
            'UPDATE users SET auth_provider = ?, provider_id = ?, avatar_url = ? WHERE id = ?',
            ['github', providerId, avatar, result.rows[0].id]
          );
          result = await query('SELECT * FROM users WHERE id = ?', [result.rows[0].id]);
          return done(null, result.rows[0]);
        }

        const id = uuidv4();
        await query(
          `INSERT INTO users (id, email, full_name, avatar_url, auth_provider, provider_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, email, fullName, avatar, 'github', providerId]
        );
        result = await query('SELECT * FROM users WHERE id = ?', [id]);
        done(null, result.rows[0]);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

module.exports = passport;

