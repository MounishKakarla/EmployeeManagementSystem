package com.employee.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(
    name = "notifications",
    indexes = {
        @Index(name = "idx_notif_emp_id",  columnList = "emp_id"),
        @Index(name = "idx_notif_is_read", columnList = "is_read"),
    }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "emp_id", nullable = false)
    private String empId;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "body", length = 1000)
    private String body;

    /** LEAVE, TIMESHEET, ATTENDANCE, SYSTEM */
    @Column(name = "category", length = 50)
    private String category;

    @Builder.Default
    @Column(name = "is_read", nullable = false)
    private boolean read = false;

    /** Optional FK to the triggering entity (leaveId, timesheetId …) */
    @Column(name = "related_id")
    private Long relatedId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
