package com.employee.services;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.employee.dto.AuditLogDTO;

public interface AuditService {

    /** Record a single audit event. */
    void log(String user, String action, String target);

    /** Paginated list of all logs — newest first. */
    Page<AuditLogDTO> getAllLogs(Pageable pageable);

    /** Filtered search across user, action, and target fields. */
    Page<AuditLogDTO> searchLogs(String user, String action, String target, Pageable pageable);

    /** All logs for a specific employee. */
    Page<AuditLogDTO> getLogsByUser(String empId, Pageable pageable);
}
