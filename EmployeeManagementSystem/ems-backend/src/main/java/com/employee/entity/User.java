package com.employee.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Data
@Table(name = "users")
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @Column(name = "emp_id", nullable = false, updatable = false)
    private String empId;

    @Column(name = "password", nullable = false)
    private String password;

    @Builder.Default
    @Column(name = "is_user_active", nullable = false)
    private Boolean isUserActive = true;

    @UpdateTimestamp
    @Column(name = "password_changed_at")
    private LocalDateTime updatedAt;

    @PreUpdate
    public void onUpdate() { this.updatedAt = LocalDateTime.now(); }

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "emp_id")
    private Employee employee;
}
