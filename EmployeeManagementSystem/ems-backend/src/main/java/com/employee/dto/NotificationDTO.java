package com.employee.dto;

import java.time.LocalDateTime;

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
public class NotificationDTO {
    private Long          id;
    private String        empId;
    private String        title;
    private String        body;
    private String        category;
    private boolean       read;
    private Long          relatedId;
    private LocalDateTime createdAt;
}
