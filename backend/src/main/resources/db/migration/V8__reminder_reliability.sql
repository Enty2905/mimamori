-- Existing timestamps were local Vietnam time in the original Vietnamese-only client.
-- Keep them for history; add an explicit UTC instant for scheduling and mobile sync.
SET time_zone = '+00:00';
ALTER TABLE users ADD COLUMN time_zone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh';
ALTER TABLE medications ADD COLUMN time_zone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh';
ALTER TABLE medication_schedules ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE medication_logs
  ADD COLUMN occurrence_id VARCHAR(64) NULL,
  ADD COLUMN scheduled_at TIMESTAMP(6) NULL,
  ADD COLUMN confirmed_at TIMESTAMP(6) NULL,
  ADD COLUMN canceled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE medication_logs SET occurrence_id=CONCAT('legacy-',id), scheduled_at=TIMESTAMPADD(HOUR,-7,scheduled_time);
ALTER TABLE medication_logs MODIFY occurrence_id VARCHAR(64) NOT NULL;
ALTER TABLE medication_logs MODIFY scheduled_at TIMESTAMP(6) NOT NULL;
CREATE UNIQUE INDEX uq_dose_occurrence ON medication_logs(occurrence_id);
CREATE INDEX idx_dose_due ON medication_logs(canceled,reminder_sent,scheduled_at);
ALTER TABLE notifications ADD COLUMN event_key VARCHAR(180) NULL;
CREATE UNIQUE INDEX uq_notification_event ON notifications(event_key);
CREATE TABLE device_registrations (
  device_id VARCHAR(64) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  token VARCHAR(2048) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  platform VARCHAR(10) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
ALTER TABLE notifications
  ADD COLUMN push_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN push_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN next_attempt_at TIMESTAMP(6) NULL;
