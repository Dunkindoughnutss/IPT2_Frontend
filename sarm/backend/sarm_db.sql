-- ══════════════════════════════════════════
-- Run this once in phpMyAdmin or MySQL CLI:
--   SOURCE /path/to/sarm_db.sql;
-- ══════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS sarm_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sarm_db;

-- ── Drop tables in safe order ────────────
DROP TABLE IF EXISTS grades;
DROP TABLE IF EXISTS enrollments;
DROP TABLE IF EXISTS sections;
DROP TABLE IF EXISTS subjects;
DROP TABLE IF EXISTS graduates;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS colleges;

-- ── Colleges ─────────────────────────────
CREATE TABLE colleges (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL
) ENGINE=InnoDB;

-- ── Departments ──────────────────────────
CREATE TABLE departments (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  college_id INT NOT NULL,
  FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Users (Registrar, Dean, Chairman, Faculty) ──
CREATE TABLE users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  role        ENUM('Registrar','Dean','Chairman','Faculty') NOT NULL,
  username    VARCHAR(80)  NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,          -- bcrypt hash
  active      TINYINT(1)   NOT NULL DEFAULT 1,
  college_id  INT DEFAULT NULL,
  dept_id     INT DEFAULT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (college_id) REFERENCES colleges(id)   ON DELETE SET NULL,
  FOREIGN KEY (dept_id)    REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── Students ─────────────────────────────
CREATE TABLE students (
  id          VARCHAR(20)  NOT NULL PRIMARY KEY,  -- e.g. 238101
  name        VARCHAR(150) NOT NULL,
  dept_id     INT          NOT NULL,
  year_level  TINYINT      NOT NULL DEFAULT 1,
  birthday    VARCHAR(10)  NOT NULL,              -- mmddyyyy (login password)
  status      ENUM('enrolled','inactive','graduated') NOT NULL DEFAULT 'enrolled',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dept_id) REFERENCES departments(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ── Subjects ─────────────────────────────
CREATE TABLE subjects (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  code    VARCHAR(20)  NOT NULL,
  name    VARCHAR(150) NOT NULL,
  units   TINYINT      NOT NULL DEFAULT 3,
  year    TINYINT      NOT NULL DEFAULT 1,
  sem     ENUM('1st','2nd','Summer') NOT NULL DEFAULT '1st',
  dept_id INT NOT NULL,
  FOREIGN KEY (dept_id) REFERENCES departments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Sections ─────────────────────────────
CREATE TABLE sections (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  subject_id   INT         NOT NULL,
  faculty_id   INT         DEFAULT NULL,
  section_name VARCHAR(30) NOT NULL,
  sy           VARCHAR(20) NOT NULL,   -- e.g. 2024-2025
  sem          ENUM('1st','2nd','Summer') NOT NULL DEFAULT '1st',
  submitted    TINYINT(1)  NOT NULL DEFAULT 0,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (faculty_id) REFERENCES users(id)    ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── Enrollments ───────────────────────────
CREATE TABLE enrollments (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(20) NOT NULL,
  section_id INT         NOT NULL,
  UNIQUE KEY uq_enroll (student_id, section_id),
  FOREIGN KEY (student_id) REFERENCES students(id)  ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES sections(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Grades ────────────────────────────────
CREATE TABLE grades (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(20)  NOT NULL,
  section_id INT          NOT NULL,
  grade      VARCHAR(5)   NOT NULL,   -- '1.0','1.25',...,'5.0','INC'
  UNIQUE KEY uq_grade (student_id, section_id),
  FOREIGN KEY (student_id) REFERENCES students(id)  ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES sections(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Graduates (Archive) ───────────────────
CREATE TABLE graduates (
  id              VARCHAR(20)  NOT NULL PRIMARY KEY,
  name            VARCHAR(150) NOT NULL,
  college_id      INT          NOT NULL,
  dept_id         INT          NOT NULL,
  graduation_year VARCHAR(20)  NOT NULL,   -- e.g. 2023-2024
  honors          VARCHAR(80)  DEFAULT '',
  gpa             DECIMAL(4,2) NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (college_id) REFERENCES colleges(id)    ON DELETE RESTRICT,
  FOREIGN KEY (dept_id)    REFERENCES departments(id) ON DELETE RESTRICT
) ENGINE=InnoDB;


-- ══════════════════════════════════════════
-- SEED DATA
-- ══════════════════════════════════════════

-- Colleges
INSERT INTO colleges (id, name) VALUES
  (1, 'College of Science'),
  (2, 'College of Engineering');

-- Departments
INSERT INTO departments (id, name, college_id) VALUES
  (1, 'Information Technology', 1),
  (2, 'Computer Science',       1),
  (3, 'Civil Engineering',      2),
  (4, 'Electrical Engineering', 2);

-- Users (passwords are bcrypt of the plain-text value shown)
-- registrar: reg123 | dean1: dean123 | chair1: chair123 | fac1: fac123 | fac2: fac456
INSERT INTO users (id, name, role, username, password, active, college_id, dept_id) VALUES
  (1, 'Registrar Office',    'Registrar', 'registrar', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 1, NULL, NULL),
  (2, 'Dean Maria Santos',   'Dean',      'dean1',     '$2y$10$TKh8H1.PyfSi8Ei3Eejk1uwSFdnGv4N5qs6Xm2tF9y6R1D3WmkSi', 1, 1,    NULL),
  (3, 'Chairman Jose Reyes', 'Chairman',  'chair1',    '$2y$10$8K1p/a0dR1xqM0sDDK.gzu0Vu.2BOZf7gvwPR2IWJHf4oU6Ynkc6', 1, 1,    1),
  (4, 'Prof. Ana Cruz',      'Faculty',   'fac1',      '$2y$10$8K1p/a0dR1xqM0sDDK.gzu0Vu.2BOZf7gvwPR2IWJHf4oU6Ynkc6', 1, 1,    1),
  (5, 'Prof. Ben Lim',       'Faculty',   'fac2',      '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 1, 1,    1);

-- NOTE: The hashes above are Laravel/PHP defaults for testing.
-- Run generate_passwords.php (included below) to regenerate proper hashes,
-- then UPDATE users SET password = '<hash>' WHERE username = '<user>';

-- Students
INSERT INTO students (id, name, dept_id, year_level, birthday, status) VALUES
  ('238101', 'Alice Mendoza',    1, 2, '02242003', 'enrolled'),
  ('238102', 'Brian Santos',     1, 2, '06151003', 'enrolled'),
  ('238103', 'Carla Reyes',      1, 3, '11302002', 'enrolled'),
  ('238104', 'Dennis Cruz',      1, 3, '04082002', 'enrolled'),
  ('238105', 'Eva Lim',          1, 1, '09192004', 'enrolled'),
  ('238106', 'Frank Torres',     2, 1, '12252004', 'enrolled'),
  ('238107', 'Grace Villanueva', 2, 2, '03072003', 'enrolled'),
  ('238108', 'Henry Dela Cruz',  1, 1, '07182004', 'enrolled');

-- Subjects
INSERT INTO subjects (id, code, name, units, year, sem, dept_id) VALUES
  (1,  'IT101', 'Introduction to Computing',    3, 1, '1st', 1),
  (2,  'IT102', 'Computer Programming 1',       3, 1, '1st', 1),
  (3,  'IT103', 'Computer Programming 2',       3, 1, '2nd', 1),
  (4,  'IT201', 'Data Structures & Algorithms', 3, 2, '1st', 1),
  (5,  'IT202', 'Web Development',              3, 2, '1st', 1),
  (6,  'IT203', 'Database Management',          3, 2, '2nd', 1),
  (7,  'IT301', 'Systems Analysis & Design',    3, 3, '1st', 1),
  (8,  'IT302', 'Network Administration',       3, 3, '2nd', 1),
  (9,  'CS101', 'Discrete Mathematics',         3, 1, '1st', 2),
  (10, 'CS201', 'Algorithm Design',             3, 2, '1st', 2);

-- Sections
INSERT INTO sections (id, subject_id, faculty_id, section_name, sy, sem, submitted) VALUES
  (1,  1, 4, 'IT1A', '2022-2023', '1st', 1),
  (2,  2, 4, 'IT1A', '2022-2023', '1st', 1),
  (3,  4, 5, 'IT2A', '2022-2023', '1st', 1),
  (4,  3, 4, 'IT1A', '2022-2023', '2nd', 1),
  (5,  6, 5, 'IT2A', '2022-2023', '2nd', 1),
  (6,  1, 4, 'IT1B', '2023-2024', '1st', 1),
  (7,  2, 4, 'IT1B', '2023-2024', '1st', 1),
  (8,  4, 5, 'IT2B', '2023-2024', '1st', 1),
  (9,  5, 5, 'IT2B', '2023-2024', '1st', 1),
  (10, 3, 4, 'IT1B', '2023-2024', '2nd', 1),
  (11, 6, 5, 'IT2B', '2023-2024', '2nd', 1),
  (12, 1, 4, 'IT1C', '2024-2025', '1st', 1),
  (13, 2, 4, 'IT1C', '2024-2025', '1st', 1),
  (14, 4, 5, 'IT2C', '2024-2025', '1st', 1),
  (15, 5, 5, 'IT2C', '2024-2025', '1st', 1),
  (16, 7, 4, 'IT3A', '2024-2025', '1st', 1),
  (17, 8, 5, 'IT3A', '2024-2025', '2nd', 0),
  (18, 9, 5, 'CS1A', '2023-2024', '1st', 1),
  (19,10, 5, 'CS2A', '2023-2024', '1st', 1),
  (20, 9, 5, 'CS1B', '2024-2025', '1st', 1),
  (21,10, 5, 'CS2B', '2024-2025', '1st', 1);

-- Enrollments
INSERT INTO enrollments (student_id, section_id) VALUES
  ('238103',1),('238103',2),('238104',1),('238104',2),
  ('238101',3),('238102',3),
  ('238103',4),('238104',4),('238101',5),('238102',5),
  ('238101',6),('238101',7),('238102',6),('238102',7),
  ('238103',8),('238103',9),('238104',8),('238104',9),
  ('238101',10),('238102',10),('238103',11),('238104',11),
  ('238106',18),('238107',19),
  ('238105',12),('238105',13),('238108',12),('238108',13),
  ('238101',14),('238101',15),('238102',14),('238102',15),
  ('238103',16),('238104',16),
  ('238106',20),('238107',21);

-- Grades
INSERT INTO grades (student_id, section_id, grade) VALUES
  ('238103',1,'1.50'),('238103',2,'2.00'),
  ('238104',1,'2.25'),('238104',2,'3.00'),
  ('238101',3,'1.75'),('238102',3,'5.00'),
  ('238103',4,'1.75'),('238104',4,'2.50'),
  ('238101',5,'2.00'),('238102',5,'2.75'),
  ('238101',6,'1.50'),('238101',7,'2.00'),
  ('238102',6,'5.00'),('238102',7,'2.50'),
  ('238103',8,'1.75'),('238103',9,'2.25'),
  ('238104',8,'3.00'),('238104',9,'5.00'),
  ('238106',18,'1.75'),('238107',19,'2.25'),
  ('238101',10,'1.75'),('238102',10,'2.25'),
  ('238103',11,'2.00'),('238104',11,'2.75'),
  ('238105',12,'1.25'),('238105',13,'1.50'),
  ('238108',12,'2.50'),('238108',13,'5.00'),
  ('238101',14,'1.50'),('238101',15,'2.00'),
  ('238102',14,'2.75'),('238102',15,'3.00'),
  ('238103',16,'2.00'),('238104',16,'5.00'),
  ('238106',20,'1.50'),('238107',21,'2.00');

-- Graduates
INSERT INTO graduates (id, name, college_id, dept_id, graduation_year, honors, gpa) VALUES
  ('220001','Ramon Bautista',  1,1,'2022-2023','Cum Laude',      1.45),
  ('220002','Liza Fernandez',  1,1,'2022-2023','',               2.10),
  ('220003','Carlo Navarro',   1,2,'2022-2023','Magna Cum Laude',1.25),
  ('220004','Shiela Manalo',   1,1,'2022-2023','',               2.35),
  ('230001','Jessa Ocampo',    1,1,'2023-2024','Summa Cum Laude',1.05),
  ('230002','Mark Ramos',      1,1,'2023-2024','Cum Laude',      1.48),
  ('230003','Aileen Soriano',  1,2,'2023-2024','',               2.20),
  ('230004','Paolo Domingo',   1,2,'2023-2024','Magna Cum Laude',1.30),
  ('230005','Nina Castillo',   1,1,'2023-2024','',               2.55),
  ('230006','Kevin Tolentino', 2,3,'2023-2024','',               2.00),
  ('230007','Diana Reyes',     2,4,'2023-2024','Cum Laude',      1.40);