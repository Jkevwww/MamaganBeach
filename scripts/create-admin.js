const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query, pool } = require('../config/database');

async function createAdmin() {
  try {
    const email = 'admin@mamagan.com';
    const password = 'admin123';
    const fullName = 'Resort Admin';

    const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.rows.length > 0) {
      console.log('Admin user already exists.');
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = uuidv4();

    await query(
      `INSERT INTO users (id, email, password_hash, full_name, auth_provider, role)
       VALUES (?, ?, ?, ?, 'local', 'admin')`,
      [id, email, passwordHash, fullName]
    );

    console.log('Admin user created successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
  } catch (err) {
    console.error('Failed to create admin:', err.message);
  } finally {
    await pool.end();
  }
}

createAdmin();

