package com.employee.entity;

import java.time.LocalDateTime;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
    name = "leave_balances",
    uniqueConstraints = @UniqueConstraint(columnNames = {"emp_id", "year"})
)
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class LeaveBalance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "emp_id", nullable = false)
    private Employee employee;

    @Column(name = "year", nullable = false)
    private Integer year;

    // ── Annual / Earned Leave ─────────────────────────────────────────────────
    // Full year entitlement : 15 days (accrued at 1.25 days/month)
    // Carry-forward         : YES (unused balance rolls to next year, capped at 30 days)
    // annualTotal = accrued this year (pro-rated from joining month) + carried forward
    @Column(name = "annual_total")            private Integer annualTotal          = 0;
    @Column(name = "annual_used")             private Integer annualUsed           = 0;
    @Column(name = "annual_carried_forward")  private Integer annualCarriedForward = 0;

    // ── Sick Leave ────────────────────────────────────────────────────────────
    // Full year entitlement : 6 days (fixed, NOT accrued monthly)
    // Carry-forward         : NO — resets to 6 every Jan 1
    // Pro-rated in joining year: ceil(monthsRemaining / 12.0 * 6)
    @Column(name = "sick_total")              private Integer sickTotal            = 0;
    @Column(name = "sick_used")               private Integer sickUsed             = 0;

    // ── Casual Leave ──────────────────────────────────────────────────────────
    // Full year entitlement : 4 days (fixed, NOT accrued monthly)
    // Carry-forward         : NO — resets to 4 every Jan 1
    // Pro-rated in joining year: ceil(monthsRemaining / 12.0 * 4)
    @Column(name = "casual_total")            private Integer casualTotal          = 0;
    @Column(name = "casual_used")             private Integer casualUsed           = 0;

    // ── Unpaid ────────────────────────────────────────────────────────────────
    // Unlimited but tracked for payroll/HR reporting
    @Column(name = "unpaid_used")             private Integer unpaidUsed           = 0;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist @PreUpdate
    public void onSave() { this.updatedAt = LocalDateTime.now(); }

    // ── Computed helpers ───────────────────────────────────────────────────────
    public int getRemainingAnnual() { return Math.max(0, nullSafe(annualTotal)  - nullSafe(annualUsed));  }
    public int getRemainingSick()   { return Math.max(0, nullSafe(sickTotal)    - nullSafe(sickUsed));    }
    public int getRemainingCasual() { return Math.max(0, nullSafe(casualTotal)  - nullSafe(casualUsed));  }

    // Defensive null guard for rows that existed before the default was applied
    private int nullSafe(Integer value) { return value != null ? value : 0; }
}