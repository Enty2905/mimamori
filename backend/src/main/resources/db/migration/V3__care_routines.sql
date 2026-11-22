-- V3__care_routines.sql
-- Daily care routines (water intake & sleep schedule) configuration and logs

CREATE TABLE IF NOT EXISTS care_routines (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    elderly_id BIGINT NOT NULL UNIQUE,
    configured_by_id BIGINT,
    water_target_cups INT NOT NULL DEFAULT 8,
    water_reminder_times VARCHAR(255) NOT NULL DEFAULT '08:00,10:30,14:00,16:30,20:00',
    bedtime_time VARCHAR(10) NOT NULL DEFAULT '21:30',
    wakeup_time VARCHAR(10) NOT NULL DEFAULT '06:00',
    sleep_target_hours DOUBLE NOT NULL DEFAULT 8.0,
    water_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sleep_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_cr_elderly FOREIGN KEY (elderly_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_cr_configured_by FOREIGN KEY (configured_by_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_cr_elderly (elderly_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS care_routine_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    elderly_id BIGINT NOT NULL,
    routine_date DATE NOT NULL,
    routine_type VARCHAR(20) NOT NULL,
    scheduled_time VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    completed_at DATETIME NULL,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_routine_slot (elderly_id, routine_date, routine_type, scheduled_time),
    CONSTRAINT fk_crl_elderly FOREIGN KEY (elderly_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_crl_elderly_date (elderly_id, routine_date),
    INDEX idx_crl_type_status (routine_type, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
