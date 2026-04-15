package com.employee.services;
import java.time.LocalDate;
import org.springframework.data.domain.*;
import com.employee.dto.EmployeeDTO;
public interface EmployeeService {
    EmployeeDTO createEmployee(EmployeeDTO dto);
    EmployeeDTO getEmployeeById(String empId);
    Page<EmployeeDTO> getAllEmployees(Pageable pageable);
    Page<EmployeeDTO> getEmployees(String name, String department, LocalDate date, String skill, Pageable pageable);
    Page<EmployeeDTO> getInactiveEmployees(Pageable pageable);
    EmployeeDTO getInactiveEmployeeById(String empId);
    void deleteEmployee(String empId);
    EmployeeDTO updateFields(String empId, EmployeeDTO dto);
}
