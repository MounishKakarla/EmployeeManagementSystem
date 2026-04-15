package com.employee.services;
public interface EmailService {
    void sendLoginDetails(String personalEmail, String empId, String companyEmail, String password, String name);
    void sendResetPasswordEmail(String empId, String name, String companyEmail, String password);
}
