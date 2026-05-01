package com.employee.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import com.employee.entity.Notification;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    Page<Notification> findByEmpIdOrderByCreatedAtDesc(String empId, Pageable pageable);

    long countByEmpIdAndReadFalse(String empId);

    @Modifying
    @Transactional
    @Query("UPDATE Notification n SET n.read = true WHERE n.id = :id AND n.empId = :empId")
    void markAsRead(Long id, String empId);

    @Modifying
    @Transactional
    @Query("UPDATE Notification n SET n.read = true WHERE n.empId = :empId AND n.read = false")
    void markAllAsRead(String empId);
}
