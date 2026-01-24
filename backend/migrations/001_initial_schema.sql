-- Deckhand Initial Schema for Supabase
-- Run this to create all tables

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Brands table
CREATE TABLE IF NOT EXISTS brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL DEFAULT 'SafelyYou',
    primary_colors JSONB DEFAULT '{}',
    secondary_colors JSONB DEFAULT '{}',
    fonts JSONB DEFAULT '{}',
    logo_urls JSONB DEFAULT '{}',
    guidelines_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Assets table
CREATE TABLE IF NOT EXISTS assets (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_url VARCHAR(512) NOT NULL,
    file_size BIGINT NOT NULL,
    tags JSONB DEFAULT '[]',
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Templates table
CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    slide_structure JSONB DEFAULT '[]',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prompts table (user prompts)
CREATE TABLE IF NOT EXISTS prompts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    prompt_text TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System prompts table
CREATE TABLE IF NOT EXISTS system_prompts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    prompt_text TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Decks table
CREATE TABLE IF NOT EXISTS decks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    prompt_used TEXT,
    template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
    google_slides_url VARCHAR(512),
    pptx_file_path VARCHAR(512),
    model_used VARCHAR(100),
    generation_time_seconds FLOAT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deck versions table
CREATE TABLE IF NOT EXISTS deck_versions (
    id SERIAL PRIMARY KEY,
    deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    prompt TEXT,
    template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
    assets_used JSONB DEFAULT '[]',
    google_slides_url VARCHAR(512),
    pptx_file_path VARCHAR(512),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Generation history table
CREATE TABLE IF NOT EXISTS generation_history (
    id SERIAL PRIMARY KEY,
    prompt TEXT,
    template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
    assets_used JSONB DEFAULT '[]',
    model_used VARCHAR(100),
    deck_id INTEGER REFERENCES decks(id) ON DELETE SET NULL,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Model configuration table (new - for admin model selection)
CREATE TABLE IF NOT EXISTS model_config (
    id SERIAL PRIMARY KEY,
    model_type VARCHAR(50) NOT NULL, -- 'llm' or 'image'
    model_id VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default system prompts
INSERT INTO system_prompts (name, prompt_text) VALUES
('orchestrator', 'You are a presentation orchestrator. Analyze the user request and create a structured outline for a slide deck. Return JSON with slide titles, key points, and suggested visuals for each slide. Keep content professional and concise.'),
('content_agent', 'You are a slide content writer. Given a slide title and key points, write compelling slide content. Keep text concise - no more than 3-5 bullet points per slide. Use clear, professional language.'),
('assembly_agent', 'You are a presentation assembler. Take individual slide content and organize it into a cohesive presentation. Ensure consistent tone and flow between slides.')
ON CONFLICT (name) DO NOTHING;

-- Insert default models
INSERT INTO model_config (model_type, model_id, display_name, is_default, is_enabled) VALUES
-- LLM Models
('llm', 'anthropic/claude-3.5-sonnet', 'Claude 3.5 Sonnet', TRUE, TRUE),
('llm', 'anthropic/claude-3-opus', 'Claude 3 Opus', FALSE, TRUE),
('llm', 'anthropic/claude-3-haiku', 'Claude 3 Haiku', FALSE, TRUE),
('llm', 'openai/gpt-4o', 'GPT-4o', FALSE, TRUE),
('llm', 'openai/gpt-4o-mini', 'GPT-4o Mini', FALSE, TRUE),
('llm', 'google/gemini-pro-1.5', 'Gemini Pro 1.5', FALSE, TRUE),
('llm', 'meta-llama/llama-3.1-70b-instruct', 'Llama 3.1 70B', FALSE, TRUE),
-- Image Models
('image', 'openai/dall-e-3', 'DALL-E 3', TRUE, TRUE),
('image', 'stabilityai/stable-diffusion-3', 'Stable Diffusion 3', FALSE, TRUE),
('image', 'nana-banana/flux-1-dev', 'Flux 1 Dev (Nana Banana)', FALSE, TRUE),
('image', 'nana-banana/flux-1-schnell', 'Flux 1 Schnell (Nana Banana)', FALSE, TRUE)
ON CONFLICT DO NOTHING;

-- Insert default brand
INSERT INTO brands (name, primary_colors, secondary_colors, fonts) VALUES
('SafelyYou',
 '{"primary": "#0091c3", "secondary": "#d4a828"}',
 '{"accent": "#8b7355", "dark": "#0a1628"}',
 '{"heading": "Playfair Display", "body": "Inter"}'
)
ON CONFLICT DO NOTHING;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_brands_updated_at ON brands;
CREATE TRIGGER update_brands_updated_at
    BEFORE UPDATE ON brands
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;
CREATE TRIGGER update_templates_updated_at
    BEFORE UPDATE ON templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prompts_updated_at ON prompts;
CREATE TRIGGER update_prompts_updated_at
    BEFORE UPDATE ON prompts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_system_prompts_updated_at ON system_prompts;
CREATE TRIGGER update_system_prompts_updated_at
    BEFORE UPDATE ON system_prompts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_model_config_updated_at ON model_config;
CREATE TRIGGER update_model_config_updated_at
    BEFORE UPDATE ON model_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
