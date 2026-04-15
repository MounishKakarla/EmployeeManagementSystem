package com.employee.repository;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.employee.entity.Employee;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee, String> {

    Employee findByEmpIdAndIsEmployeeActiveTrue(String empId);
    Page<Employee> findByIsEmployeeActiveTrue(Pageable p);
    Page<Employee> findByIsEmployeeActiveFalse(Pageable p);
    Page<Employee> findByNameContainingIgnoreCaseAndIsEmployeeActiveTrue(String name, Pageable p);

    @Query("SELECT e FROM Employee e WHERE e.isEmployeeActive=true AND UPPER(e.department) LIKE UPPER(CONCAT('%',:d,'%'))")
    Page<Employee> findByDepartmentContainingAndActive(@Param("d") String d, Pageable p);

    Page<Employee> findByDateOfJoinGreaterThanEqualAndIsEmployeeActiveTrue(LocalDate date, Pageable p);

    @Query("SELECT e FROM Employee e WHERE e.isEmployeeActive=true AND UPPER(e.skills) LIKE UPPER(CONCAT('%',:s,'%'))")
    Page<Employee> findBySkillContainingAndActive(@Param("s") String s, Pageable p);

    Employee findByEmpIdAndIsEmployeeActiveFalse(String empId);
    boolean existsByCompanyEmail(String email);
    boolean existsByPersonalEmail(String email);
    boolean existsByPhoneNumber(String phone);

    /** Used by LeaveYearEndScheduler to iterate all active employees */
    List<Employee> findAllByIsEmployeeActiveTrue();
}