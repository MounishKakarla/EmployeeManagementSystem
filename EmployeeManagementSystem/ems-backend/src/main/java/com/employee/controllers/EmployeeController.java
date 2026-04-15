package com.employee.controllers;

import java.time.LocalDate;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.employee.dto.EmployeeDTO;
import com.employee.servicesImpl.EmployeeServiceImpl;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/ems")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class EmployeeController {

    private final EmployeeServiceImpl employeeService;

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/employee")
    public EmployeeDTO addEmployee(@RequestBody EmployeeDTO request) {
        return employeeService.createEmployee(request);
    }

    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','EMPLOYEE')")
    @GetMapping("/profile")
    public EmployeeDTO getMyProfile(Authentication authentication) {
        if (authentication == null) throw new RuntimeException("Authentication is null");
        return employeeService.getEmployeeById(authentication.getName());
    }

    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @GetMapping("/employee/{empId}")
    public EmployeeDTO getEmployeeById(@PathVariable String empId) {
        return employeeService.getEmployeeById(empId);
    }

    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @GetMapping("/employees")
    public Page<EmployeeDTO> searchEmployees(
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) LocalDate date,
            @RequestParam(required = false) String skill,
            Pageable pageable) {
        return employeeService.getEmployees(name, department, date, skill, pageable);
    }

    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @GetMapping("/employees/inactive")
    public Page<EmployeeDTO> getInactiveEmployees(Pageable pageable) {
        return employeeService.getInactiveEmployees(pageable);
    }

    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @GetMapping("/employee/inactive/{empId}")
    public EmployeeDTO getInactiveEmployeeById(@PathVariable String empId) {
        return employeeService.getInactiveEmployeeById(empId);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/employee/{empId}")
    public ResponseEntity<String> deleteEmployee(@PathVariable String empId) {
        employeeService.deleteEmployee(empId);
        return ResponseEntity.ok("Employee deactivated successfully");
    }

    @PreAuthorize("hasAnyRole('ADMIN','MANAGER') or #empId == authentication.name")
    @PatchMapping("/update/{empId}")
    public EmployeeDTO updateFields(@PathVariable String empId, @RequestBody EmployeeDTO dto) {
        return employeeService.updateFields(empId, dto);
    }
}
