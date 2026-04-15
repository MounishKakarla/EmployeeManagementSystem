-- Initialize Database Schema (In case script runs before Spring Boot starts up)

CREATE TABLE IF NOT EXISTS employees (
    emp_id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    company_email VARCHAR(255) NOT NULL UNIQUE,
    personal_email VARCHAR(255) NOT NULL UNIQUE,
    phone_number VARCHAR(255) NOT NULL UNIQUE,
    address TEXT NOT NULL,
    department VARCHAR(500) NOT NULL,
    designation VARCHAR(500) NOT NULL,
    skills VARCHAR(1000),
    date_of_join DATE NOT NULL,
    date_of_birth DATE NOT NULL,
    description TEXT,
    date_of_exit DATE,
    is_employee_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    emp_id VARCHAR(255) PRIMARY KEY REFERENCES employees(emp_id),
    password VARCHAR(255) NOT NULL,
    is_user_active BOOLEAN NOT NULL DEFAULT TRUE,
    password_changed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
    role_id SERIAL PRIMARY KEY,
    role VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS user_roles (
    emp_id VARCHAR(255) NOT NULL REFERENCES employees(emp_id),
    role_id INTEGER NOT NULL REFERENCES roles(role_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (emp_id, role_id)
);


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
