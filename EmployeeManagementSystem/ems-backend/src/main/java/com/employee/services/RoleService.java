package com.employee.services;
public interface RoleService {
    void assignRole(String empId, String roleName);
    void removeRole(String empId, String roleName);
}
