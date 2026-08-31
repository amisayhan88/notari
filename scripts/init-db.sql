-- Runs automatically on first boot of the docker-compose db.
-- For hosted Neon/Supabase instances, run the same statement once
-- in the SQL editor instead.
CREATE EXTENSION IF NOT EXISTS vector;
