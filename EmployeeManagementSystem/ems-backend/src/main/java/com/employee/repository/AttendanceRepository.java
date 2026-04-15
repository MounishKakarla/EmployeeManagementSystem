package com.employee.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.employee.entity.Attendance;
import com.employee.enums.AttendanceStatus;

@Repository
public interface AttendanceRepository extends JpaRepository<Attendance, Long> {

    // ── Single record for a specific employee + date ───────────────────────────
    Optional<Attendance> findByEmployeeEmpIdAndAttendanceDate(
            String empId, LocalDate date);

    // ── All records for an employee (paginated) ────────────────────────────────
    Page<Attendance> findByEmployeeEmpIdOrderByAttendanceDateDesc(
            String empId, Pageable pageable);

    // ── Records for an employee within a date range ────────────────────────────
    List<Attendance> findByEmployeeEmpIdAndAttendanceDateBetweenOrderByAttendanceDateAsc(
            String empId, LocalDate startDate, LocalDate endDate);

    // ── All records for a given date (for manager daily view) ─────────────────
    @Query("SELECT a FROM Attendance a JOIN FETCH a.employee e " +
           "WHERE a.attendanceDate = :date " +
           "ORDER BY e.name ASC")
    List<Attendance> findAllByDateWithEmployee(@Param("date") LocalDate date);

    // ── All records for a department on a date ─────────────────────────────────
    @Query("SELECT a FROM Attendance a JOIN a.employee e " +
           "WHERE a.attendanceDate = :date " +
           "AND UPPER(e.department) LIKE UPPER(CONCAT('%', :department, '%')) " +
           "ORDER BY e.name ASC")
    List<Attendance> findByDateAndDepartment(
            @Param("date") LocalDate date,
            @Param("department") String department);

    // ── Monthly summary counts (used for AttendanceSummaryDTO) ────────────────
    @Query("SELECT COUNT(a) FROM Attendance a " +
           "WHERE a.employee.empId = :empId " +
           "AND MONTH(a.attendanceDate) = :month " +
           "AND YEAR(a.attendanceDate) = :year " +
           "AND a.status = :status")
    long countByEmpIdAndMonthAndYearAndStatus(
            @Param("empId") String empId,
            @Param("month") int month,
            @Param("year") int year,
            @Param("status") AttendanceStatus status);

    // ── Total hours in a month ─────────────────────────────────────────────────
    @Query("SELECT COALESCE(SUM(a.totalHours), 0.0) FROM Attendance a " +
           "WHERE a.employee.empId = :empId " +
           "AND MONTH(a.attendanceDate) = :month " +
           "AND YEAR(a.attendanceDate) = :year")
    Double sumHoursByEmpIdAndMonthAndYear(
            @Param("empId") String empId,
            @Param("month") int month,
            @Param("year") int year);

    // ── Check if today's record exists (for check-in guard) ───────────────────
    boolean existsByEmployeeEmpIdAndAttendanceDate(String empId, LocalDate date);

    // ── Team attendance for a date range (admin/manager) ──────────────────────
    @Query("SELECT a FROM Attendance a JOIN a.employee e " +
           "WHERE a.attendanceDate BETWEEN :start AND :end " +
           "AND (:empId IS NULL OR e.empId = :empId) " +
           "ORDER BY a.attendanceDate DESC, e.name ASC")
    Page<Attendance> findTeamAttendance(
            @Param("start") LocalDate start,
            @Param("end") LocalDate end,
            @Param("empId") String empId,
            Pageable pageable);

    // ── Absent employees on a date (for alerts) ────────────────────────────────
    @Query("SELECT e.empId FROM Employee e " +
           "WHERE e.isEmployeeActive = true " +
           "AND e.empId NOT IN (" +
           "  SELECT a.employee.empId FROM Attendance a " +
           "  WHERE a.attendanceDate = :date" +
           ")")
    List<String> findAbsentEmployeeIdsOnDate(@Param("date") LocalDate date);
}
