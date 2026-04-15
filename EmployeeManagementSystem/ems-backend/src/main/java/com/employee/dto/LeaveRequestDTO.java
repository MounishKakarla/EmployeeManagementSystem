// ─────────────────────────────────────────────────────────────────────────────
// LeaveRequestDTO.java  →  com/employee/dto/LeaveRequestDTO.java
// ─────────────────────────────────────────────────────────────────────────────
package com.employee.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

import com.employee.enums.LeaveStatus;
import com.employee.enums.LeaveType;
import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LeaveRequestDTO {
    private Long        id;
    private String      empId;
    private String      employeeName;
    private String      department;
    private LeaveType   leaveType;
    private LocalDate   startDate;
    private LocalDate   endDate;
    private Integer     daysRequested;
    private String      reason;
    private LeaveStatus status;
    private String      reviewedBy;
    private LocalDateTime reviewedAt;
    private String      reviewNotes;
    private LocalDateTime createdAt;
}
