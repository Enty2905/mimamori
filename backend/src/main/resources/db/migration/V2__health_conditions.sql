-- V2__health_conditions.sql
-- Medical conditions & follow-up checkup tracking for elderly care

CREATE TABLE IF NOT EXISTS health_conditions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    elderly_id BIGINT NOT NULL,
    created_by_id BIGINT,
    condition_name VARCHAR(150) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'MONITORING',
    severity VARCHAR(20) NOT NULL DEFAULT 'MODERATE',
    record_date DATE NOT NULL,
    next_checkup_date DATE,
    doctor_or_clinic VARCHAR(150),
    symptoms_or_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_hc_elderly FOREIGN KEY (elderly_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_hc_creator FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_hc_elderly_date (elderly_id, record_date),
    INDEX idx_hc_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
