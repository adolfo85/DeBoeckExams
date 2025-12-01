import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.local');

// Manual env parsing
let connectionString = '';
try {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/VITE_DATABASE_URL=(.*)/);
    if (match && match[1]) {
        connectionString = match[1].trim();
        // Remove quotes if present
        if (connectionString.startsWith('"') && connectionString.endsWith('"')) {
            connectionString = connectionString.slice(1, -1);
        }
    }
} catch (e) {
    console.error('Could not read .env.local');
    process.exit(1);
}

if (!connectionString) {
    console.error('VITE_DATABASE_URL not found in .env.local');
    process.exit(1);
}

const sql = neon(connectionString);

async function migrate() {
    console.log('Starting migration...');

    try {
        // 1. Create Teachers Table
        console.log('Creating teachers table...');
        await sql`
      CREATE TABLE IF NOT EXISTS teachers (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      );
    `;

        // 2. Add teacher_id to subjects
        console.log('Adding teacher_id to subjects...');
        // We use DO block to check if column exists to avoid error on re-run
        await sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='teacher_id') THEN 
          ALTER TABLE subjects ADD COLUMN teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE;
        END IF; 
      END $$;
    `;

        console.log('Migration completed successfully!');
    } catch (e) {
        console.error('Migration failed:', e);
        process.exit(1);
    }
}

migrate();
