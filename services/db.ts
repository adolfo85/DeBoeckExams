import { neon } from '@neondatabase/serverless';

// Get the connection string from environment variables
const connectionString = import.meta.env.VITE_DATABASE_URL;

if (!connectionString) {
    console.error("Database connection string missing! Make sure VITE_DATABASE_URL is set in .env.local");
}

// Create a SQL query builder
// If connectionString is missing, return a dummy function that rejects
export const sql = connectionString
    ? neon(connectionString)
    : async (...args: any[]) => {
        throw new Error("Database connection not configured. Check VITE_DATABASE_URL.");
    };
