const fs = require('fs');
const path = require('path');
const { query, pool } = require('../config/database');

async function initDatabase() {
  try {
    console.log('Initializing Mamagan Beach Resort database (MySQL)...\n');

    // Read schema
    const schemaPath = path.join(__dirname, '..', 'database', 'schema_v2.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Read seed data
    const seedPath = path.join(__dirname, '..', 'database', 'seed.sql');
    const seed = fs.readFileSync(seedPath, 'utf8');

    // Split schema by semicolons to execute statements individually
    const schemaStatements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
    
    console.log('Creating tables...');
    for (const stmt of schemaStatements) {
      await query(stmt);
    }
    console.log('Tables created successfully.');

    // Split seed statements
    const seedStatements = seed.split(';').map(s => s.trim()).filter(s => s.length > 0);
    
    console.log('Seeding sample data...');
    for (const stmt of seedStatements) {
      await query(stmt);
    }
    console.log('Sample data seeded successfully.');

    console.log('\nDatabase initialization complete!');
    console.log('You can now start the server with: npm run dev');
  } catch (err) {
    console.error('\nDatabase initialization failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();

