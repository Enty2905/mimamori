CREATE TABLE conversation_turns (
  request_id CHAR(36) PRIMARY KEY,
  conversation_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL,
  lease_id CHAR(36) NOT NULL,
  lease_until TIMESTAMP(6) NOT NULL,
  reply_message_id BIGINT NULL,
  FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(reply_message_id) REFERENCES chat_messages(id) ON DELETE SET NULL
);
