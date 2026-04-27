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
    @Builder.Default @Column(name = "annual_total")            private Integer annualTotal          = 0;
    @Builder.Default @Column(name = "annual_used")             private Integer annualUsed           = 0;
    @Builder.Default @Column(name = "annual_carried_forward")  private Integer annualCarriedForward = 0;

    // ── Sick Leave ────────────────────────────────────────────────────────────
    // Full year entitlement : 6 days (fixed, NOT accrued monthly)
    // Carry-forward         : NO — resets to 6 every Jan 1
    // Pro-rated in joining year: ceil(monthsRemaining / 12.0 * 6)
    @Builder.Default @Column(name = "sick_total")              private Integer sickTotal            = 0;
    @Builder.Default @Column(name = "sick_used")               private Integer sickUsed             = 0;

    // ── Casual Leave ──────────────────────────────────────────────────────────
    // Full year entitlement : 4 days (fixed, NOT accrued monthly)
    // Carry-forward         : NO — resets to 4 every Jan 1
    // Pro-rated in joining year: ceil(monthsRemaining / 12.0 * 4)
    @Builder.Default @Column(name = "casual_total")            private Integer casualTotal          = 0;
    @Builder.Default @Column(name = "casual_used")             private Integer casualUsed           = 0;

    // ── Maternity Leave ───────────────────────────────────────────────────────
    // Entitlement : 182 calendar days (as per Maternity Benefit Act, 1961)
    // Carry-forward: NO — granted once per pregnancy; does not roll over
    @Builder.Default @Column(name = "maternity_total")         private Integer maternityTotal       = 0;
    @Builder.Default @Column(name = "maternity_used")          private Integer maternityUsed        = 0;

    // ── Paternity Leave ───────────────────────────────────────────────────────
    // Entitlement : 15 calendar days (common corporate policy)
    // Can be split. Carry-forward: NO
    @Builder.Default @Column(name = "paternity_total")         private Integer paternityTotal       = 0;
    @Builder.Default @Column(name = "paternity_used")          private Integer paternityUsed        = 0;

    // ── Compensatory Off / Comp-Off ──────────────────────────────────────────
    // Earned when employee works on a holiday/weekend. Each such day = 1 comp-off.
    // Carry-forward: YES but typically expires within 90 days (tracked via earned/used)
    @Builder.Default @Column(name = "comp_off_earned")         private Integer compOffEarned        = 0;
    @Builder.Default @Column(name = "comp_off_used")           private Integer compOffUsed          = 0;

    // ── Sick / Casual (combined) ──────────────────────────────────────────────
    // Merged entitlement : 10 days (replaces separate 6+4 policy)
    // Carry-forward         : NO — resets to 10 every Jan 1
    @Builder.Default @Column(name = "sick_casual_total")       private Integer sickCasualTotal      = 0;
    @Builder.Default @Column(name = "sick_casual_used")        private Integer sickCasualUsed       = 0;

    // ── Unpaid ────────────────────────────────────────────────────────────────
    // Unlimited but tracked for payroll/HR reporting
    @Builder.Default @Column(name = "unpaid_used")             private Integer unpaidUsed           = 0;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist @PreUpdate
    public void onSave() { this.updatedAt = LocalDateTime.now(); }

    // ── Computed helpers ───────────────────────────────────────────────────────
    public int getRemainingAnnual()      { return Math.max(0, nullSafe(annualTotal)      - nullSafe(annualUsed));      }
    public int getRemainingSick()        { return Math.max(0, nullSafe(sickTotal)        - nullSafe(sickUsed));        }
    public int getRemainingCasual()      { return Math.max(0, nullSafe(casualTotal)      - nullSafe(casualUsed));      }
    public int getRemainingSickCasual()  { return Math.max(0, nullSafe(sickCasualTotal)  - nullSafe(sickCasualUsed));  }
    public int getRemainingMaternity()   { return Math.max(0, nullSafe(maternityTotal)   - nullSafe(maternityUsed));   }
    public int getRemainingPaternity()   { return Math.max(0, nullSafe(paternityTotal)   - nullSafe(paternityUsed));   }
    public int getRemainingCompOff()     { return Math.max(0, nullSafe(compOffEarned)    - nullSafe(compOffUsed));     }

    // Defensive null guard for rows that existed before the default was applied
    private int nullSafe(Integer value) { return value != null ? value : 0; }
}