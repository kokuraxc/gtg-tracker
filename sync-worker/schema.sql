CREATE TABLE IF NOT EXISTS records (
  user_id     TEXT    NOT NULL,
  kind        TEXT    NOT NULL,            -- exercises | sessions | sets
  uuid        TEXT    NOT NULL,
  modified_at INTEGER NOT NULL,            -- client clock, ms (last-write-wins)
  deleted     INTEGER NOT NULL DEFAULT 0,
  data        TEXT,                        -- JSON payload (NULL when deleted)
  seq         INTEGER NOT NULL,            -- server change counter, used as pull cursor
  PRIMARY KEY (user_id, kind, uuid)
);

CREATE INDEX IF NOT EXISTS idx_records_user_seq ON records (user_id, seq);
CREATE INDEX IF NOT EXISTS idx_records_seq ON records (seq);
