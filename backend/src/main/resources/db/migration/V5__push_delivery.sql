CREATE TABLE notification_deliveries (
  notification_id BIGINT NOT NULL,
  device_id VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMP(6) NULL,
  PRIMARY KEY(notification_id,device_id),
  FOREIGN KEY(notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  FOREIGN KEY(device_id) REFERENCES device_registrations(device_id) ON DELETE CASCADE
);
