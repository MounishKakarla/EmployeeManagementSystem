package com.employee.services;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.employee.dto.AttendanceDTO;
import com.employee.dto.AttendanceSummaryDTO;

public interface AttendanceService {

    // ── Employee self-service ──────────────────────────────────────────────────

    /** Mark own check-in for today. Fails if already checked in today. */
    AttendanceDTO checkIn(String empId, String notes);

    /** Mark own check-out for today. Fails if not yet checked in. */
    AttendanceDTO checkOut(String empId);

    /** Get own attendance history (paginated). */
    Page<AttendanceDTO> getMyAttendance(String empId, Pageable pageable);

    /** Get own attendance for a date range (for calendar view). */
    List<AttendanceDTO> getMyAttendanceRange(String empId, LocalDate start, LocalDate end);

    /** Get own summary for a given month/year. */
    AttendanceSummaryDTO getMySummary(String empId, int month, int year);

    // ── Admin / Manager operations ─────────────────────────────────────────────

    /** Manually create or override an attendance record for any employee. */
    AttendanceDTO createOrOverride(AttendanceDTO dto, String recordedBy);

    /** Update an existing attendance record (admin/manager correction). */
    AttendanceDTO update(Long id, AttendanceDTO dto, String updatedBy);

    /** Delete an attendance record. */
    void delete(Long id);

    /** Get all team attendance for a date range, optionally filtered by empId. */
    Page<AttendanceDTO> getTeamAttendance(LocalDate start, LocalDate end,
                                          String empId, Pageable pageable);

    /** Get all attendance for a specific date (daily roster view). */
    List<AttendanceDTO> getDailyAttendance(LocalDate date, String department);

    /** Get summary for any employee (admin/manager). */
    AttendanceSummaryDTO getSummary(String empId, int month, int year);

    /** Get today's status for an employee. */
    AttendanceDTO getTodayStatus(String empId);
}
