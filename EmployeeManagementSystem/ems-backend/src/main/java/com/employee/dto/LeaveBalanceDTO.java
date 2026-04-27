package com.employee.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LeaveBalanceDTO {

    private String  empId;
    private String  employeeName;
    private Integer year;

    // Annual / Earned Leave
    private Integer annualTotal;           // accrued + carried forward
    private Integer annualUsed;
    private Integer annualRemaining;
    private Integer annualCarriedForward;  // how much was brought from last year
    private Integer annualAccruedThisYear; // just this year's portion (for display)

    // Sick Leave
    private Integer sickTotal;
    private Integer sickUsed;
    private Integer sickRemaining;

    // Casual Leave (legacy — kept for historical data display)
    private Integer casualTotal;
    private Integer casualUsed;
    private Integer casualRemaining;

    // Sick / Casual (combined — 10 days)
    private Integer sickCasualTotal;
    private Integer sickCasualUsed;
    private Integer sickCasualRemaining;

    // Maternity Leave (182 calendar days per Maternity Benefit Act, 1961)
    private Integer maternityTotal;
    private Integer maternityUsed;
    private Integer maternityRemaining;

    // Paternity Leave (15 calendar days — corporate policy)
    private Integer paternityTotal;
    private Integer paternityUsed;
    private Integer paternityRemaining;

    // Compensatory Off (earned by working on holidays/weekends)
    private Integer compOffEarned;
    private Integer compOffUsed;
    private Integer compOffRemaining;

    // Unpaid (unlimited — tracked for payroll)
    private Integer unpaidUsed;

    // Meta info
    private String  accrualNote;
}