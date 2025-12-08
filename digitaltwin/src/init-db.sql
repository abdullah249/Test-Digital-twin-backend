-- Create agents table
CREATE TABLE IF NOT EXISTS agents (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  type TEXT NOT NULL,
  capabilities TEXT[] NOT NULL,
  avatar TEXT NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{"requests_handled": 0, "success_rate": 0, "avg_response_time": 0}'
);

-- Create digital_twins table
CREATE TABLE IF NOT EXISTS digital_twins (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  avatar TEXT NOT NULL,
  capabilities TEXT[] NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  configuration JSONB NOT NULL DEFAULT '{"personality": "friendly", "voice_id": "21m00Tcm4TlvDq8ikWAM", "voice_settings": {"stability": 0.75, "similarityBoost": 0.75, "style": 0.5, "speakerBoost": true}}'
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  assigned_agent_id INTEGER REFERENCES agents(id),
  assigned_twin_id INTEGER REFERENCES digital_twins(id),
  metadata JSONB DEFAULT '{}'
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  participants TEXT[] NOT NULL,
  topic TEXT NOT NULL,
  transcript TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
