package com.employee.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.employee.entity.AuditLog;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    // Paginated all logs — newest first (for the audit log viewer page)
    Page<AuditLog> findAllByOrderByCreatedAtDesc(Pageable pageable);

    // Filter by user (empId), action keyword, or target keyword
    @Query("SELECT a FROM AuditLog a WHERE " +
           "(:user IS NULL OR a.user = :user) AND " +
           "(:action IS NULL OR LOWER(a.action) LIKE LOWER(CONCAT('%', :action, '%'))) AND " +
           "(:target IS NULL OR LOWER(a.target) LIKE LOWER(CONCAT('%', :target, '%'))) " +
           "ORDER BY a.createdAt DESC")
    Page<AuditLog> findFiltered(
            @Param("user")   String user,
            @Param("action") String action,
            @Param("target") String target,
            Pageable pageable);

    // All logs by a specific user
    Page<AuditLog> findByUserOrderByCreatedAtDesc(String user, Pageable pageable);
}
