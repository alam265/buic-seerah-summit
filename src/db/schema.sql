-- BUIC Seerah Competition - PostgreSQL Database Schema for Neon
-- Executed automatically by server on startup if tables do not exist.

CREATE TABLE IF NOT EXISTS registrations (
    id SERIAL PRIMARY KEY,
    ticket_id VARCHAR(30) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    student_id VARCHAR(50) NOT NULL,
    semester VARCHAR(20) NOT NULL,
    department VARCHAR(100) NOT NULL,
    whatsapp VARCHAR(20) NOT NULL,
    facebook_link TEXT,
    gsuit_email VARCHAR(100) NOT NULL,
    personal_email VARCHAR(100) NOT NULL,
    gender VARCHAR(20) NOT NULL,
    bkash_txn_id VARCHAR(50) NOT NULL,
    seerah_read_before TEXT,
    engagement_suggestions TEXT,
    programme_expectation TEXT,
    invitation_source VARCHAR(150),
    uswatun_hasanah_read VARCHAR(10),
    uswatun_hasanah_participation VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes for Registrations
CREATE INDEX IF NOT EXISTS idx_registrations_student_id ON registrations(student_id);
CREATE INDEX IF NOT EXISTS idx_registrations_whatsapp ON registrations(whatsapp);
CREATE INDEX IF NOT EXISTS idx_registrations_gsuit_email ON registrations(gsuit_email);
CREATE INDEX IF NOT EXISTS idx_registrations_personal_email ON registrations(personal_email);
CREATE INDEX IF NOT EXISTS idx_registrations_ticket_id ON registrations(ticket_id);

-- Admin Users Table
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);

-- =====================================================================
-- MIGRATION: Applied automatically on server startup (see db.js).
-- Safe to re-run; IF NOT EXISTS / IF EXISTS prevent errors on fresh installs.
-- =====================================================================
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS student_id VARCHAR(50) NOT NULL DEFAULT 'N/A';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS semester VARCHAR(20) NOT NULL DEFAULT 'N/A';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS department VARCHAR(100) NOT NULL DEFAULT 'N/A';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20) NOT NULL DEFAULT 'N/A';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS facebook_link TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS gsuit_email VARCHAR(100) NOT NULL DEFAULT 'N/A';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS personal_email VARCHAR(100) NOT NULL DEFAULT 'N/A';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS gender VARCHAR(20) NOT NULL DEFAULT 'Other';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS bkash_txn_id VARCHAR(50) NOT NULL DEFAULT 'N/A';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS seerah_read_before TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS engagement_suggestions TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS programme_expectation TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS invitation_source VARCHAR(150);
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS uswatun_hasanah_read VARCHAR(10);
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS uswatun_hasanah_participation VARCHAR(200);
ALTER TABLE registrations DROP COLUMN IF EXISTS email;
ALTER TABLE registrations DROP COLUMN IF EXISTS phone;
ALTER TABLE registrations DROP COLUMN IF EXISTS roll_no;
ALTER TABLE registrations DROP COLUMN IF EXISTS institution;
ALTER TABLE registrations DROP COLUMN IF EXISTS category;
ALTER TABLE registrations DROP COLUMN IF EXISTS address;
