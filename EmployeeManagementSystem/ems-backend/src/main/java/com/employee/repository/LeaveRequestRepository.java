package com.employee.repository;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.employee.entity.LeaveRequest;
import com.employee.enums.LeaveStatus;
import com.employee.enums.LeaveType;

@Repository
public interface LeaveRequestRepository extends JpaRepository<LeaveRequest, Long> {

    // Own history — newest first
    Page<LeaveRequest> findByEmployeeEmpIdOrderByCreatedAtDesc(String empId, Pageable pageable);

    // All PENDING requests (for manager/admin review)
    Page<LeaveRequest> findByStatusOrderByCreatedAtAsc(LeaveStatus status, Pageable pageable);

    // All requests for admin — filterable by empId and/or status
    @Query("SELECT l FROM LeaveRequest l WHERE " +
           "(:empId IS NULL OR l.employee.empId = :empId) AND " +
           "(:status IS NULL OR l.status = :status) " +
           "ORDER BY l.createdAt DESC")
    Page<LeaveRequest> findAllFiltered(
            @Param("empId")   String empId,
            @Param("status")  LeaveStatus status,
            Pageable pageable);

    // Check overlapping dates for the same employee (prevent double-booking)
    @Query("SELECT COUNT(l) FROM LeaveRequest l WHERE " +
           "l.employee.empId = :empId AND " +
           "l.status IN ('PENDING', 'APPROVED') AND " +
           "l.startDate <= :endDate AND l.endDate >= :startDate")
    long countOverlapping(
            @Param("empId")     String empId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate")   LocalDate endDate);

    // Used days in a year for a specific leave type
    @Query("SELECT COALESCE(SUM(l.daysRequested), 0) FROM LeaveRequest l WHERE " +
           "l.employee.empId = :empId AND " +
           "l.leaveType = :leaveType AND " +
           "l.status = 'APPROVED' AND " +
           "YEAR(l.startDate) = :year")
    int sumApprovedDays(
            @Param("empId")     String empId,
            @Param("leaveType") LeaveType leaveType,
            @Param("year")      int year);

    /**
     * Manager-scoped pending queue: only PENDING requests from employees in
     * the given department, oldest first (FIFO fairness).
     */
    @Query("SELECT l FROM LeaveRequest l " +
           "WHERE l.status = 'PENDING' " +
           "AND UPPER(l.employee.department) = UPPER(:department) " +
           "ORDER BY l.createdAt ASC")
    Page<LeaveRequest> findPendingByDepartment(
            @Param("department") String department,
            Pageable pageable);
}

