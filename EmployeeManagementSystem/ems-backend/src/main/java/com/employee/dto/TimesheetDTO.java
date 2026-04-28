package com.employee.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import com.employee.enums.TimesheetStatus;
import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TimesheetDTO {
    private Long            id;
    private String          empId;
    private String          employeeName;
    private String          department;
    private LocalDate       weekStartDate;
    private String          project;
    private String          taskDescription;
    private BigDecimal      mondayHours;
    private BigDecimal      tuesdayHours;
    private BigDecimal      wednesdayHours;
    private BigDecimal      thursdayHours;
    private BigDecimal      fridayHours;
    private BigDecimal      saturdayHours;
    private BigDecimal      sundayHours;
    private BigDecimal      totalHours;
    private TimesheetStatus status;
    private LocalDateTime   submittedAt;
    private String          approvedBy;
    private LocalDateTime   approvedAt;
    private String          reviewNotes;
    private String          startTime;
    private String          endTime;
    private LocalDateTime   createdAt;
}
