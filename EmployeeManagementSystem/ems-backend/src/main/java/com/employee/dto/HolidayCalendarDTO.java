package com.employee.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class HolidayCalendarDTO {
    private Long      id;
    private LocalDate holidayDate;
    private String    name;
    private String    description;
    private Boolean   isMandatory;
    private String    createdBy;
    private LocalDateTime createdAt;
}
