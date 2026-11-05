-- V1__init_schema.sql
-- Mimamori AI: Core Relational Database Schema

-- 1. Users table (Elderly & Caregiver)
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL, -- 'ELDERLY', 'CAREGIVER'
    phone VARCHAR(20),
    emergency_contact VARCHAR(100),
    avatar_url VARCHAR(255),
    language_preference VARCHAR(10) DEFAULT 'vi',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_role (role),
    INDEX idx_users_username (username),
    INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Family relationships (Linking Caregiver with Elderly)
CREATE TABLE IF NOT EXISTS family_relationships (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    caregiver_id BIGINT NOT NULL,
    elderly_id BIGINT NOT NULL,
    relationship_type VARCHAR(50) DEFAULT 'FAMILY', -- 'CHILD', 'SPOUSE', 'CAREGIVER', etc.
    status VARCHAR(20) DEFAULT 'ACCEPTED', -- 'PENDING', 'ACCEPTED', 'REJECTED'
    can_view_conversations BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_family_pair (caregiver_id, elderly_id),
    CONSTRAINT fk_rel_caregiver FOREIGN KEY (caregiver_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_rel_elderly FOREIGN KEY (elderly_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_rel_caregiver (caregiver_id),
    INDEX idx_rel_elderly (elderly_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Medications
CREATE TABLE IF NOT EXISTS medications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    elderly_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    dosage VARCHAR(50) NOT NULL,
    instructions TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_med_elderly FOREIGN KEY (elderly_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_med_elderly (elderly_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Medication schedules (Daily times e.g. 08:00, 12:30, 20:00)
CREATE TABLE IF NOT EXISTS medication_schedules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    medication_id BIGINT NOT NULL,
    reminder_time TIME NOT NULL,
    dosage_amount VARCHAR(50),
    days_of_week VARCHAR(20) DEFAULT 'DAILY', -- 'DAILY' or 'MON,TUE,WED'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sched_medication FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
    INDEX idx_sched_med (medication_id),
    INDEX idx_sched_time (reminder_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Medication logs (Track actual intake vs missed)
CREATE TABLE IF NOT EXISTS medication_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    schedule_id BIGINT,
    medication_id BIGINT NOT NULL,
    elderly_id BIGINT NOT NULL,
    scheduled_time DATETIME NOT NULL,
    taken_time DATETIME,
    status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'TAKEN', 'MISSED', 'SKIPPED'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_log_schedule FOREIGN KEY (schedule_id) REFERENCES medication_schedules(id) ON DELETE SET NULL,
    CONSTRAINT fk_log_medication FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
    CONSTRAINT fk_log_elderly FOREIGN KEY (elderly_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_log_elderly_scheduled (elderly_id, scheduled_time),
    INDEX idx_log_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Daily Check-ins
CREATE TABLE IF NOT EXISTS daily_checkins (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    elderly_id BIGINT NOT NULL,
    checkin_date DATE NOT NULL,
    mood VARCHAR(20) NOT NULL, -- 'EXCELLENT', 'GOOD', 'OKAY', 'TIRED', 'POOR'
    physical_health VARCHAR(50) NOT NULL, -- 'GOOD', 'TIRED', 'PAIN', 'DIZZY', etc.
    sleep_quality VARCHAR(20) NOT NULL, -- 'GOOD', 'NORMAL', 'POOR', 'INSOMNIA'
    appetite VARCHAR(20) NOT NULL, -- 'GOOD', 'NORMAL', 'POOR'
    notes TEXT,
    concerning_flag BOOLEAN DEFAULT FALSE,
    ai_analysis_summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_elderly_date (elderly_id, checkin_date),
    CONSTRAINT fk_checkin_elderly FOREIGN KEY (elderly_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_checkin_elderly_date (elderly_id, checkin_date),
    INDEX idx_checkin_concern (concerning_flag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    elderly_id BIGINT NOT NULL,
    title VARCHAR(100) DEFAULT 'Hội thoại với Trợ lý AI',
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_conv_elderly FOREIGN KEY (elderly_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_conv_elderly (elderly_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    sender VARCHAR(20) NOT NULL, -- 'USER', 'AI', 'SYSTEM'
    content TEXT NOT NULL,
    tokens_used INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_msg_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    INDEX idx_msg_conv_time (conversation_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Care alerts
CREATE TABLE IF NOT EXISTS care_alerts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    elderly_id BIGINT NOT NULL,
    caregiver_id BIGINT,
    alert_type VARCHAR(50) NOT NULL, -- 'MISSED_MEDICATION', 'MISSED_CHECKIN', 'CHECKIN_CONCERN', 'SYSTEM_NOTIFICATION'
    severity VARCHAR(20) NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    description TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_alert_elderly FOREIGN KEY (elderly_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_alert_caregiver FOREIGN KEY (caregiver_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_alert_elderly (elderly_id),
    INDEX idx_alert_caregiver (caregiver_id),
    INDEX idx_alert_status (is_read, is_resolved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Daily activity summaries
CREATE TABLE IF NOT EXISTS daily_summaries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    elderly_id BIGINT NOT NULL,
    summary_date DATE NOT NULL,
    medication_adherence_rate DOUBLE DEFAULT 1.0,
    checkin_summary TEXT,
    alert_count INT DEFAULT 0,
    ai_health_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_summary_elderly_date (elderly_id, summary_date),
    CONSTRAINT fk_summary_elderly FOREIGN KEY (elderly_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_summary_date (elderly_id, summary_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Push Notifications / In-app notifications
CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title VARCHAR(150) NOT NULL,
    body TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'REMINDER', 'ALERT', 'CHECKIN', 'SYSTEM'
    reference_id BIGINT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notif_user (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

