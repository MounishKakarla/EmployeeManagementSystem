package com.employee.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ImportResultDTO {

    private int successCount;
    private int failureCount;
    private List<ImportErrorDTO> errors;
    private List<EmployeeDTO>    createdEmployees;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ImportErrorDTO {
        private int    rowNumber;
        private String empId;    // null if creation failed before ID assignment
        private String message;
    }
}
