-- =====================================================
-- IPTV Manager - Database Initialization
-- =====================================================
-- This runs automatically on first PostgreSQL start

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure proper encoding
SET client_encoding = 'UTF8';
