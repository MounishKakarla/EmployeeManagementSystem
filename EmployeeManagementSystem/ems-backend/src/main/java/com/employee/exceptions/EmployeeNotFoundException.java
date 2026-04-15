package com.employee.exceptions;
public class EmployeeNotFoundException extends RuntimeException {
    public EmployeeNotFoundException(String m) { super(m); }
}
