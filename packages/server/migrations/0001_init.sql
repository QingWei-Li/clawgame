-- D1 schema for agent identity and match history persistence
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  token TEXT NOT NULL UNIQUE,
  games INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agents_token ON agents(token);

CREATE TABLE IF NOT EXISTS agent_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  side INTEGER NOT NULL,
  result TEXT NOT NULL,
  finish_reason TEXT NOT NULL,
  opponent_actor_type TEXT,
  opponent_name TEXT,
  opponent_actor_id TEXT,
  mode TEXT NOT NULL,
  moves INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_history_agent_finished ON agent_history(agent_id, finished_at DESC);
