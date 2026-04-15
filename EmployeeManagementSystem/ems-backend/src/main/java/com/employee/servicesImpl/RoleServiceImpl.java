package com.employee.servicesImpl;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import com.employee.entity.Employee;
import com.employee.entity.Roles;
import com.employee.entity.UserRoles;
import com.employee.enums.RolesEnum;
import com.employee.exceptions.EmployeeNotFoundException;
import com.employee.repository.EmployeeRepository;
import com.employee.repository.RoleRepository;
import com.employee.repository.UserRoleRepository;
import com.employee.services.AuditService;
import com.employee.services.RoleService;
import com.employee.utils.UserRoleId;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class RoleServiceImpl implements RoleService {

    private final RoleRepository     roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final EmployeeRepository employeeRepository;
    private final AuditService       auditService;

    @Override
    @Transactional
    public void assignRole(String empId, String roleName) {
        String actor = currentUser();

        // SELF-PROTECTION: no one can assign roles to themselves
        if (actor.equals(empId)) {
            throw new IllegalStateException(
                "You cannot assign roles to your own account. Another ADMIN must perform this action.");
        }

        Roles role = roleRepository.findByRole(RolesEnum.valueOf(roleName))
                .orElseThrow(() -> new IllegalArgumentException("Invalid role: " + roleName));
        Employee employee = employeeRepository.findById(empId)
                .orElseThrow(() -> new EmployeeNotFoundException("Employee not found: " + empId));

        UserRoleId id = new UserRoleId(empId, role.getRoleId());
        if (userRoleRepository.existsById(id))
            throw new IllegalStateException("Role already assigned to this employee");

        UserRoles userRole = new UserRoles();
        userRole.setId(id); userRole.setEmployee(employee); userRole.setRole(role);
        userRoleRepository.save(userRole);

        auditService.log(actor, "ASSIGN_ROLE_" + roleName,
                "Assigned role " + roleName + " to employee " + empId);
    }

    @Override
    @Transactional
    public void removeRole(String empId, String roleName) {
        String actor = currentUser();

        // SELF-PROTECTION: no one can revoke roles from themselves
        if (actor.equals(empId)) {
            throw new IllegalStateException(
                "You cannot revoke roles from your own account. Another ADMIN must perform this action.");
        }

        Roles role = roleRepository.findByRole(RolesEnum.valueOf(roleName))
                .orElseThrow(() -> new IllegalArgumentException("Invalid role: " + roleName));
        UserRoleId id = new UserRoleId(empId, role.getRoleId());
        UserRoles userRole = userRoleRepository.findById(id)
                .orElseThrow(() -> new IllegalStateException("Role not assigned to this employee"));
        userRoleRepository.delete(userRole);

        auditService.log(actor, "REMOVE_ROLE_" + roleName,
                "Removed role " + roleName + " from employee " + empId);
    }

    private String currentUser() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            return (auth != null && auth.isAuthenticated()) ? auth.getName() : "SYSTEM";
        } catch (Exception e) { return "SYSTEM"; }
    }
}