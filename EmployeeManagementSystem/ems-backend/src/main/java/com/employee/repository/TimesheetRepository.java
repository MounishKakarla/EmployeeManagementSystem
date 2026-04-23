package com.employee.repository;

import java.time.LocalDate;
import java.util.List;


import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.employee.entity.Timesheet;
import com.employee.enums.TimesheetStatus;

@Repository
public interface TimesheetRepository extends JpaRepository<Timesheet, Long> {

    // All entries for the employee for a specific week (multiple projects)
    List<Timesheet> findByEmployeeEmpIdAndWeekStartDate(String empId, LocalDate weekStartDate);

    // Own history — newest week first
    Page<Timesheet> findByEmployeeEmpIdOrderByWeekStartDateDesc(String empId, Pageable pageable);

    // Team timesheets — filterable by status and/or empId
    @Query("SELECT t FROM Timesheet t WHERE " +
           "(:empId IS NULL OR t.employee.empId = :empId) AND " +
           "(:status IS NULL OR t.status = :status) " +
           "ORDER BY t.weekStartDate DESC, t.employee.name ASC")
    Page<Timesheet> findTeamTimesheets(
            @Param("empId")  String empId,
            @Param("status") TimesheetStatus status,
            Pageable pageable);

    // All SUBMITTED timesheets pending approval
    Page<Timesheet> findByStatusOrderBySubmittedAtAsc(TimesheetStatus status, Pageable pageable);

    // Check uniqueness: same employee + week + project
    boolean existsByEmployeeEmpIdAndWeekStartDateAndProject(
            String empId, LocalDate weekStartDate, String project);
}
