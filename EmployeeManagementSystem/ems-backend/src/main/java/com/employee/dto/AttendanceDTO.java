package com.employee.dto;

import java.time.LocalDate;
import java.time.LocalTime;

import com.employee.enums.AttendanceStatus;
import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AttendanceDTO {

    private Long id;

    // ── Employee info (populated in responses) ─────────────────────────────────
    private String empId;
    private String employeeName;
    private String department;
    private String profileImage;

    // ── Attendance details ─────────────────────────────────────────────────────
    private LocalDate attendanceDate;
    private LocalTime checkInTime;
    private LocalTime checkOutTime;
    private Double totalHours;
    private AttendanceStatus status;
    private String notes;
    private String recordedBy;
}
