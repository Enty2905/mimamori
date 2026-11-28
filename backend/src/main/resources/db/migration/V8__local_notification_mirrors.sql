CREATE TABLE local_notification_mirrors (
  device_id VARCHAR(64) NOT NULL,
  occurrence_id VARCHAR(64) NOT NULL,
  owner_id BIGINT NOT NULL,
  expires_at TIMESTAMP(6) NOT NULL,
  PRIMARY KEY(device_id,occurrence_id),
  FOREIGN KEY(device_id) REFERENCES device_registrations(device_id) ON DELETE CASCADE,
  FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
);
