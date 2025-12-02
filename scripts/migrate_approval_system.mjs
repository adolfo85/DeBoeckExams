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
    console.log('Starting approval system migration...');

    try {
        // 1. Add approval fields to teachers table
        console.log('Adding approval fields to teachers table...');
        await sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teachers' AND column_name='is_approved') THEN 
          ALTER TABLE teachers ADD COLUMN is_approved BOOLEAN NOT NULL DEFAULT false;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teachers' AND column_name='is_super_admin') THEN 
          ALTER TABLE teachers ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT false;
        END IF;
      END $$;
    `;

        // 2. Create/Update Super Admin account
        console.log('Creating super admin account...');
        const superAdminEmail = 'adolfodeboeck@gmail.com';
        const superAdminPassword = '31842796a';
        const superAdminName = 'Adolfo De Boeck';

        // Check if super admin exists
        const existing = await sql`SELECT id FROM teachers WHERE email = ${superAdminEmail}`;

        if (existing.length > 0) {
            // Update existing account to be super admin
            await sql`
        UPDATE teachers 
        SET is_super_admin = true, is_approved = true, password = ${superAdminPassword}
        WHERE email = ${superAdminEmail}
      `;
            console.log('Super admin account updated');
        } else {
            // Create new super admin account
            await sql`
        INSERT INTO teachers (id, name, email, password, is_super_admin, is_approved)
        VALUES (gen_random_uuid(), ${superAdminName}, ${superAdminEmail}, ${superAdminPassword}, true, true)
      `;
            console.log('Super admin account created');
        }

        // 3. Create/Update Test User
        console.log('Creating test user...');
        const testEmail = 'profesor.prueba@deboeckexams.com';
        const testPassword = 'prueba123';
        const testName = 'Profesor de Prueba';

        const existingTest = await sql`SELECT id FROM teachers WHERE email = ${testEmail}`;

        if (existingTest.length > 0) {
            // Update existing test account
            await sql`
        UPDATE teachers 
        SET is_approved = true, password = ${testPassword}
        WHERE email = ${testEmail}
      `;
            console.log('Test user updated');
        } else {
            // Create new test user
            await sql`
        INSERT INTO teachers (id, name, email, password, is_super_admin, is_approved)
        VALUES (gen_random_uuid(), ${testName}, ${testEmail}, ${testPassword}, false, true)
      `;
            console.log('Test user created');
        }

        console.log('\n=== Migration completed successfully! ===');
        console.log('\nSuper Admin credentials:');
        console.log('Email: adolfodeboeck@gmail.com');
        console.log('Password: 31842796a');
        console.log('\nTest User credentials:');
        console.log('Email: profesor.prueba@deboeckexams.com');
        console.log('Password: prueba123');

    } catch (e) {
        console.error('Migration failed:', e);
        process.exit(1);
    }
}

migrate();
