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

    // Casual Leave
    private Integer casualTotal;
    private Integer casualUsed;
    private Integer casualRemaining;

    // Unpaid
    private Integer unpaidUsed;

    // Meta info
    private String  accrualNote;  // e.g. "Accruing 1.25 days/month. Next accrual: 1 May 2025"
}