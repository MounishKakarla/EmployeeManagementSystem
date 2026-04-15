package com.employee.dto;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AuditLogDTO {
    private Long          id;
    private String        user;
    private String        action;
    private String        target;
    private LocalDateTime createdAt;
}
