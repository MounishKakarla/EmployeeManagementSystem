-- Create roles
INSERT INTO roles (role) VALUES ('ADMIN'), ('MANAGER'), ('EMPLOYEE');

-- Create a dummy admin employee for E2E tests
-- Password is 'password' (bcrypt hash for 'password')
INSERT INTO employee (emp_id, name, company_email, personal_email, phone_number, password, is_employee_active, failed_attempt, account_non_locked) 
VALUES ('TEST_ADMIN', 'Test Admin', 'admin@test.com', 'personal@test.com', '1234567890', '$2a$10$DowzZ8yM8T5k3mK0X1gMru4c0Z.tJjU.nB.a6w1c6k2/o.oB5aL9m', true, 0, true);

-- Assign ADMIN role to TEST_ADMIN (Assuming Role ID 1 is ADMIN)
INSERT INTO user_roles (emp_id, role_id) VALUES ('TEST_ADMIN', 1);
