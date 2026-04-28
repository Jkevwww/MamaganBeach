require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const caCertPath = path.join(__dirname, '..', 'ca.pem');
let sslConfig = false;

if (process.env.DB_SSL === 'true') {
  if (fs.existsSync(caCertPath)) {
    sslConfig = {
      ca: fs.readFileSync(caCertPath),
      rejectUnauthorized: false,
    };
  } else {
    sslConfig = { rejectUnauthorized: false };
  }
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: sslConfig,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  connectTimeout: 20000,
  enableKeepAlive: true,
});

pool.on('connection', () => {
  console.log('MySQL connection established');
});

async function query(sql, params) {
  const [rows] = await pool.execute(sql, params);
  return { rows };
}

module.exports = {
  query,
  pool,
};

