package com.employee.dto;

import java.time.LocalDate;
import java.util.Set;

import com.employee.enums.RolesEnum;
import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.*;

@JsonInclude(JsonInclude.Include.NON_NULL)
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class EmployeeDTO {
    private String    empId;
    private String    name;
    private String    companyEmail;
    private String    personalEmail;
    private String    phoneNumber;
    private String    address;
    private String    department;
    private String    designation;
    private String    skills;
    private LocalDate dateOfJoin;
    private LocalDate dateOfBirth;
    private String    description;
    private LocalDate dateOfExit;
    private Boolean   isEmployeeActive;
    private Set<RolesEnum> roles;
}
