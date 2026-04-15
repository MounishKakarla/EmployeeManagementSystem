package com.employee.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "audit_logs")
@Getter @Setter @AllArgsConstructor @NoArgsConstructor @Builder
public class AuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "log_user", nullable = false)
    private String user;

    @Column(nullable = false)
    private String action;

    @Column(nullable = false, length = 1000)
    private String target;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;
}
