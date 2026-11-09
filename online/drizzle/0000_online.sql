CREATE TABLE rooms (id TEXT PRIMARY KEY NOT NULL, revision INTEGER NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE host_budget (scope TEXT PRIMARY KEY NOT NULL, calls INTEGER NOT NULL DEFAULT 0, lease_token TEXT, lease_until INTEGER NOT NULL DEFAULT 0, prompt_tokens INTEGER NOT NULL DEFAULT 0, completion_tokens INTEGER NOT NULL DEFAULT 0, total_tokens INTEGER NOT NULL DEFAULT 0, last_result TEXT, last_success_at TEXT, last_latency_ms INTEGER, updated_at INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE host_jobs (id TEXT PRIMARY KEY NOT NULL, room_id TEXT NOT NULL, economic_key TEXT NOT NULL, status TEXT NOT NULL, lease_until INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX host_jobs_room_idx ON host_jobs(room_id);
