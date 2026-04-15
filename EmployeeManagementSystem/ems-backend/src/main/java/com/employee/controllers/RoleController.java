package com.employee.controllers;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.employee.repository.UserRoleRepository;
import com.employee.services.AuditService;
import com.employee.services.RoleService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/ems")
@RequiredArgsConstructor
public class RoleController {

    private final RoleService        roleService;
    private final UserRoleRepository userRoleRepository;
    private final AuditService       auditService;

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/assign/{empId}")
    public void assignRole(Authentication auth, @PathVariable String empId,
                           @RequestParam String grantRole) {
        roleService.assignRole(empId, grantRole);
        auditService.log(auth.getName(), "ASSIGN_ROLE_" + grantRole, "Assigned to " + empId);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/remove/{empId}")
    public void removeRole(Authentication auth, @PathVariable String empId,
                           @RequestParam String revokeRole) {
        roleService.removeRole(empId, revokeRole);
        auditService.log(auth.getName(), "REMOVE_ROLE_" + revokeRole, "Removed from " + empId);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/roles/{empId}")
    public ResponseEntity<List<String>> getEmployeeRoles(@PathVariable String empId) {
        List<String> roles = userRoleRepository.findByEmployeeEmpId(empId)
                .stream().map(ur -> ur.getRole().getRole().name()).toList();
        return ResponseEntity.ok(roles);
    }
}
