ALTER TABLE care_routines
    ADD COLUMN water_target_ml INT NOT NULL DEFAULT 1400 AFTER water_target_cups,
    ADD COLUMN water_cup_ml INT NOT NULL DEFAULT 200 AFTER water_target_ml;

UPDATE care_routines
SET water_target_ml = 1400,
    water_cup_ml = 200,
    water_target_cups = 7
WHERE water_target_cups = 8;

UPDATE care_routines
SET water_target_ml = GREATEST(600, LEAST(3000, water_target_cups * 200)),
    water_cup_ml = 200
WHERE water_target_cups <> 7;
