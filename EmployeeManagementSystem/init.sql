

-- Step 0: Create sequence for employee IDs
CREATE SEQUENCE IF NOT EXISTS emp_id_seq START 1;


INSERT INTO roles (role)
VALUES 
    ('ADMIN'),
    ('MANAGER'),
    ('EMPLOYEE')
ON CONFLICT (role) DO NOTHING;

-- Step 1: Insert into employees table
INSERT INTO employees (
    emp_id,
    name,
    company_email,
    personal_email,
    phone_number,
    address,
    department,
    designation,
    skills,
    date_of_join,
    date_of_birth,
    description,
    gender,
    date_of_exit,
    is_employee_active,
    created_at,
    updated_at
) VALUES (
    'TT0001',
    'Mounish Kakarla',
    'mounish.k@tektalis.com',
    'mounsihchowdary1432@gmail.com',
    '7993175737',
    'Hyderabad',
    'Development',
    'Software Engineer',
    'Java, Spring Boot, PostgreSQL, ReactJS,Docker,Python,AI,HTML,CSS',
    '2025-12-15',
    '2003-02-17',
    'Backend developer with 2 years of experience',
    'MALE',
    NULL,
    TRUE,
    NOW(),
    NOW()
) ON CONFLICT (emp_id) DO NOTHING;


INSERT INTO users (
    emp_id,
    password,
    is_user_active,
    password_changed_at
) VALUES (
    'TT0001',
    '$2a$12$5gHPxFcrc4tbgYsIqDWqy.EuT6lnWzQwDQvZwpLBAL/1oj4LRab/C',
    TRUE,
    NOW()
) ON CONFLICT (emp_id) DO NOTHING;


-- Step 2: Assign specific roles to TT0001
INSERT INTO user_roles (emp_id, role_id)
SELECT 'TT0001', role_id FROM roles WHERE role IN ('ADMIN', 'MANAGER','EMPLOYEE')
ON CONFLICT (emp_id, role_id) DO NOTHING;


-- Step 3: Sequence correction
-- Since we manually inserted TT0001, we need to advance the sequence so the next user is TT0002
ALTER SEQUENCE emp_id_seq RESTART WITH 2;

-- Step 4: Fix legacy row
-- Force gender update in case TT0001 was already seeded before the gender column existed
UPDATE employees SET gender = 'MALE' WHERE emp_id = 'TT0001' AND gender IS NULL;
