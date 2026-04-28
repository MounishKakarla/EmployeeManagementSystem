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

    // Own history — newest week first, optional date range
    @Query("SELECT t FROM Timesheet t WHERE t.employee.empId = :empId AND " +
           "(:from IS NULL OR t.weekStartDate >= :from) AND " +
           "(:to IS NULL OR t.weekStartDate <= :to) " +
           "ORDER BY t.weekStartDate DESC")
    Page<Timesheet> findByEmployeeEmpIdAndDateRange(
            @Param("empId") String empId,
            @Param("from")  LocalDate from,
            @Param("to")    LocalDate to,
            Pageable pageable);

    // Team timesheets — filterable by empId, status, optional date range
    // DRAFT entries are excluded (private to the employee) unless explicitly filtered
    @Query("SELECT t FROM Timesheet t WHERE " +
           "t.status <> com.employee.enums.TimesheetStatus.DRAFT AND " +
           "(:empId IS NULL OR t.employee.empId = :empId) AND " +
           "(:status IS NULL OR t.status = :status) AND " +
           "(:from IS NULL OR t.weekStartDate >= :from) AND " +
           "(:to IS NULL OR t.weekStartDate <= :to) " +
           "ORDER BY t.weekStartDate DESC, t.employee.name ASC")
    Page<Timesheet> findTeamTimesheets(
            @Param("empId")  String empId,
            @Param("status") TimesheetStatus status,
            @Param("from")   LocalDate from,
            @Param("to")     LocalDate to,
            Pageable pageable);

    // All SUBMITTED timesheets pending approval
    Page<Timesheet> findByStatusOrderBySubmittedAtAsc(TimesheetStatus status, Pageable pageable);

    // Check uniqueness: same employee + week + project
    boolean existsByEmployeeEmpIdAndWeekStartDateAndProject(
            String empId, LocalDate weekStartDate, String project);
}
