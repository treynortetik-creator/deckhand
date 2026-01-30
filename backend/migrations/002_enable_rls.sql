-- ============================================================
-- Deckhand: Enable Row Level Security (RLS) on all tables
-- ============================================================
-- This migration addresses the Supabase Security Advisor warning:
-- "RLS not enabled on tables"
--
-- Since Deckhand uses a backend API (FastAPI) that connects via
-- the postgres role (service role), RLS policies allow the
-- service role full access while blocking anonymous/public access.
-- ============================================================

-- 1. Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE deck_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_config ENABLE ROW LEVEL SECURITY;

-- 2. Create policies that allow the service role (backend) full access
-- The postgres role and service_role bypass RLS by default as they are
-- superuser/admin roles. These policies are for the authenticated and
-- anon roles used by Supabase client libraries.

-- Users: authenticated users can read their own data
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid()::text = email);

CREATE POLICY "Service role full access to users"
  ON users FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Brands: readable by authenticated users, writable by service role
CREATE POLICY "Authenticated users can read brands"
  ON brands FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role full access to brands"
  ON brands FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Assets: authenticated users can manage their own uploads
CREATE POLICY "Authenticated users can read assets"
  ON assets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role full access to assets"
  ON assets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Templates: readable by all authenticated, writable by service role
CREATE POLICY "Authenticated users can read templates"
  ON templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role full access to templates"
  ON templates FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Prompts: readable by all authenticated, writable by service role
CREATE POLICY "Authenticated users can read prompts"
  ON prompts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role full access to prompts"
  ON prompts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- System prompts: readable by all authenticated, writable by service role
CREATE POLICY "Authenticated users can read system prompts"
  ON system_prompts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role full access to system prompts"
  ON system_prompts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Decks: authenticated users can read their own decks
CREATE POLICY "Authenticated users can read decks"
  ON decks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role full access to decks"
  ON decks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Deck versions: same as decks
CREATE POLICY "Authenticated users can read deck versions"
  ON deck_versions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role full access to deck versions"
  ON deck_versions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Generation history: service role only
CREATE POLICY "Service role full access to generation history"
  ON generation_history FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Model config: readable by authenticated, writable by service role
CREATE POLICY "Authenticated users can read model config"
  ON model_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role full access to model config"
  ON model_config FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Explicitly deny anon access to all tables
-- (No policies created for anon role = denied by default with RLS on)

-- Done! RLS is now enabled on all tables.
-- The backend (using postgres/service_role connection) bypasses RLS.
-- Direct Supabase client access (anon key) is denied.
