package com.employee.entity;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import org.hibernate.annotations.CreationTimestamp;

import com.employee.enums.AttendanceStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(
    name = "attendance",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"emp_id", "attendance_date"})
    }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Attendance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ── Employee link ──────────────────────────────────────────────────────────
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "emp_id", nullable = false)
    private Employee employee;

    // ── Date / time ────────────────────────────────────────────────────────────
    @Column(name = "attendance_date", nullable = false)
    private LocalDate attendanceDate;

    @Column(name = "check_in_time")
    private LocalTime checkInTime;

    @Column(name = "check_out_time")
    private LocalTime checkOutTime;

    // ── Computed hours (set on save) ───────────────────────────────────────────
    @Column(name = "total_hours")
    private Double totalHours;

    // ── Status ─────────────────────────────────────────────────────────────────
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private AttendanceStatus status = AttendanceStatus.PRESENT;

    // ── Override / notes ───────────────────────────────────────────────────────
    @Column(name = "notes", length = 500)
    private String notes;

    // ── Who recorded this entry ────────────────────────────────────────────────
    @Column(name = "recorded_by")
    private String recordedBy;

    // ── Timestamps ─────────────────────────────────────────────────────────────
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void onCreate() {
        computeTotalHours();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void onUpdate() {
        computeTotalHours();
        this.updatedAt = LocalDateTime.now();
    }

    // ── Helper: compute hours from check-in / check-out ───────────────────────
    // Handles overnight shifts: if checkout < checkin, assume checkout is next day.
    private void computeTotalHours() {
        if (checkInTime == null || checkOutTime == null) {
            this.totalHours = 0.0;
            return;
        }
        long minutes = java.time.Duration.between(checkInTime, checkOutTime).toMinutes();
        if (minutes <= 0) {
            // Overnight shift — checkout is on the next calendar day
            minutes += 24 * 60;
        }
        if (minutes <= 0 || minutes >= 24 * 60) {
            this.totalHours = 0.0; // invalid: same time (wrapped to 1440) or > 24h
        } else {
            this.totalHours = Math.round((minutes / 60.0) * 100.0) / 100.0;
        }
    }
}
