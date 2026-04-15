package com.employee.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttendanceSummaryDTO {

    private String empId;
    private String employeeName;

    // ── Monthly counts ─────────────────────────────────────────────────────────
    private int month;
    private int year;
    private int totalWorkingDays;
    private int presentDays;
    private int absentDays;
    private int halfDays;
    private int lateDays;
    private int onLeaveDays;
    private int workFromHomeDays;
    private int holidayDays;
    private int weekendDays;

    // ── Hours ──────────────────────────────────────────────────────────────────
    private Double totalHoursWorked;
    private Double averageHoursPerDay;

    // ── Attendance percentage ──────────────────────────────────────────────────
    private Double attendancePercentage;
}
