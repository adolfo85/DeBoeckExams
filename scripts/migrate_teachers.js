import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load env vars manually since we are running this with ts-node/node, not Vite
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const sql = neon(envConfig.VITE_DATABASE_URL);

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
    }
}

migrate();
