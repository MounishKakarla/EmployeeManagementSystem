package com.employee.controllers;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.employee.dto.AuditLogDTO;
import com.employee.services.AuditService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/ems/audit")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditService auditService;

    /**
     * GET /ems/audit/logs?page=0&size=20
     * All logs, newest first. ADMIN only.
     */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/logs")
    public Page<AuditLogDTO> getAllLogs(Pageable pageable) {
        return auditService.getAllLogs(pageable);
    }

    /**
     * GET /ems/audit/logs/search?user=TT0001&action=CREATE&target=Employee
     * Filtered search. ADMIN only.
     */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/logs/search")
    public Page<AuditLogDTO> searchLogs(
            @RequestParam(required = false) String user,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String target,
            Pageable pageable) {
        return auditService.searchLogs(user, action, target, pageable);
    }

    /**
     * GET /ems/audit/logs/user/{empId}
     * All logs for a specific employee. ADMIN only.
     */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/logs/user/{empId}")
    public Page<AuditLogDTO> getByUser(
            @PathVariable String empId, Pageable pageable) {
        return auditService.getLogsByUser(empId, pageable);
    }
}
