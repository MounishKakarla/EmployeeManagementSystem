package com.employee.servicesImpl;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import com.employee.dto.AuditLogDTO;
import com.employee.entity.AuditLog;
import com.employee.repository.AuditLogRepository;
import com.employee.services.AuditService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AuditServiceImpl implements AuditService {

    private final AuditLogRepository auditLogRepository;

    @Override
    public void log(String user, String action, String target) {
        auditLogRepository.save(
                AuditLog.builder().user(user).action(action).target(target).build());
    }

    @Override
    public Page<AuditLogDTO> getAllLogs(Pageable pageable) {
        return auditLogRepository.findAllByOrderByCreatedAtDesc(pageable).map(this::toDTO);
    }

    @Override
    public Page<AuditLogDTO> searchLogs(String user, String action,
                                         String target, Pageable pageable) {
        String u = (user   != null && !user.isBlank())   ? user.trim()   : null;
        String a = (action != null && !action.isBlank()) ? action.trim() : null;
        String t = (target != null && !target.isBlank()) ? target.trim() : null;
        return auditLogRepository.findFiltered(u, a, t, pageable).map(this::toDTO);
    }

    @Override
    public Page<AuditLogDTO> getLogsByUser(String empId, Pageable pageable) {
        return auditLogRepository.findByUserOrderByCreatedAtDesc(empId, pageable)
                                 .map(this::toDTO);
    }

    private AuditLogDTO toDTO(AuditLog log) {
        return AuditLogDTO.builder()
                .id(log.getId())
                .user(log.getUser())
                .action(log.getAction())
                .target(log.getTarget())
                .createdAt(log.getCreatedAt())
                .build();
    }
}
