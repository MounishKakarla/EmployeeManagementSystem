package com.employee.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import com.employee.enums.TimesheetStatus;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "timesheets")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Timesheet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "emp_id", nullable = false)
    private Employee employee;

    // Always the Monday of the ISO week
    @Column(name = "week_start_date", nullable = false)
    private LocalDate weekStartDate;

    @Column(name = "project", nullable = false, length = 200)
    private String project;

    @Column(name = "task_description", length = 1000)
    private String taskDescription;

    // Hours per day (up to 24.00 each)
    @Builder.Default @Column(name = "monday_hours",    precision = 4, scale = 2) private BigDecimal mondayHours    = BigDecimal.ZERO;
    @Builder.Default @Column(name = "tuesday_hours",   precision = 4, scale = 2) private BigDecimal tuesdayHours   = BigDecimal.ZERO;
    @Builder.Default @Column(name = "wednesday_hours", precision = 4, scale = 2) private BigDecimal wednesdayHours = BigDecimal.ZERO;
    @Builder.Default @Column(name = "thursday_hours",  precision = 4, scale = 2) private BigDecimal thursdayHours  = BigDecimal.ZERO;
    @Builder.Default @Column(name = "friday_hours",    precision = 4, scale = 2) private BigDecimal fridayHours    = BigDecimal.ZERO;
    @Builder.Default @Column(name = "saturday_hours",  precision = 4, scale = 2) private BigDecimal saturdayHours  = BigDecimal.ZERO;
    @Builder.Default @Column(name = "sunday_hours",    precision = 4, scale = 2) private BigDecimal sundayHours    = BigDecimal.ZERO;

    // Computed on every save
    @Column(name = "total_hours", precision = 5, scale = 2)
    private BigDecimal totalHours;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private TimesheetStatus status = TimesheetStatus.DRAFT;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "approved_by")
    private String approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "review_notes", length = 500)
    private String reviewNotes;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void onCreate() {
        this.createdAt = LocalDateTime.now();
        computeTotal();
    }

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = LocalDateTime.now();
        computeTotal();
    }

    private void computeTotal() {
        this.totalHours = mondayHours
                .add(tuesdayHours)
                .add(wednesdayHours)
                .add(thursdayHours)
                .add(fridayHours)
                .add(saturdayHours)
                .add(sundayHours);
    }
}
