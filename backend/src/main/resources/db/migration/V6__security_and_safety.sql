ALTER TABLE users ADD COLUMN session_version BIGINT NOT NULL DEFAULT 0;
CREATE TABLE refresh_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  session_version BIGINT NOT NULL,
  expires_at TIMESTAMP(6) NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_refresh_user (user_id)
);
ALTER TABLE care_alerts ADD COLUMN event_key VARCHAR(180) NULL;
CREATE UNIQUE INDEX uq_alert_event ON care_alerts(event_key);
