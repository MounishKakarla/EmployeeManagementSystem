package com.employee.controllers;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.employee.dto.AttendanceDTO;
import com.employee.dto.AttendanceSummaryDTO;
import com.employee.services.AttendanceService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/ems/attendance")
@RequiredArgsConstructor
public class AttendanceController {

    private final AttendanceService attendanceService;

    // ════════════════════════════════════════════════════════════════════════════
    // Employee self-service endpoints
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * POST /ems/attendance/check-in
     * Marks today's check-in for the authenticated employee.
     * Optional body: { "notes": "WFH today" }
     */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','EMPLOYEE')")
    @PostMapping("/check-in")
    public ResponseEntity<AttendanceDTO> checkIn(
            Authentication auth,
            @RequestBody(required = false) AttendanceDTO body) {

        String notes = (body != null) ? body.getNotes() : null;
        return ResponseEntity.ok(attendanceService.checkIn(auth.getName(), notes));
    }

    /**
     * POST /ems/attendance/check-out
     * Marks today's check-out for the authenticated employee.
     */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','EMPLOYEE')")
    @PostMapping("/check-out")
    public ResponseEntity<AttendanceDTO> checkOut(Authentication auth) {
        return ResponseEntity.ok(attendanceService.checkOut(auth.getName()));
    }

    /**
     * GET /ems/attendance/today
     * Returns today's attendance record for the authenticated employee (null if not checked in).
     */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','EMPLOYEE')")
    @GetMapping("/today")
    public ResponseEntity<AttendanceDTO> getToday(Authentication auth) {
        AttendanceDTO today = attendanceService.getTodayStatus(auth.getName());
        return ResponseEntity.ok(today);
    }

    /**
     * GET /ems/attendance/my?page=0&size=20
     * Paginated own attendance history.
     */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','EMPLOYEE')")
    @GetMapping("/my")
    public Page<AttendanceDTO> getMyAttendance(Authentication auth, Pageable pageable) {
        return attendanceService.getMyAttendance(auth.getName(), pageable);
    }

    /**
     * GET /ems/attendance/my/range?start=2025-01-01&end=2025-01-31
     * Own attendance for a date range (used by the calendar view).
     */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','EMPLOYEE')")
    @GetMapping("/my/range")
    public List<AttendanceDTO> getMyRange(
            Authentication auth,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end) {
        return attendanceService.getMyAttendanceRange(auth.getName(), start, end);
    }

    /**
     * GET /ems/attendance/my/summary?month=1&year=2025
     * Monthly attendance summary for the authenticated employee.
     */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','EMPLOYEE')")
    @GetMapping("/my/summary")
    public AttendanceSummaryDTO getMySummary(
            Authentication auth,
            @RequestParam int month,
            @RequestParam int year) {
        return attendanceService.getMySummary(auth.getName(), month, year);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Admin / Manager endpoints
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * POST /ems/attendance/override
     * Create or override an attendance record for any employee.
     * Body: AttendanceDTO with empId, attendanceDate, checkInTime, checkOutTime, status, notes.
     */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @PostMapping("/override")
    public ResponseEntity<AttendanceDTO> createOrOverride(
            Authentication auth,
            @RequestBody AttendanceDTO dto) {
        return ResponseEntity.ok(
                attendanceService.createOrOverride(dto, auth.getName()));
    }

    /**
     * PUT /ems/attendance/{id}
     * Update an existing attendance record (admin correction).
     */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @PutMapping("/{id}")
    public ResponseEntity<AttendanceDTO> update(
            Authentication auth,
            @PathVariable Long id,
            @RequestBody AttendanceDTO dto) {
        return ResponseEntity.ok(
                attendanceService.update(id, dto, auth.getName()));
    }

    /**
     * DELETE /ems/attendance/{id}
     * Delete an attendance record.
     */
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<String> delete(@PathVariable Long id) {
        attendanceService.delete(id);
        return ResponseEntity.ok("Attendance record deleted successfully");
    }

    /**
     * GET /ems/attendance/team?start=2025-01-01&end=2025-01-31&empId=TT0001
     * Paginated team attendance. empId filter is optional.
     */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @GetMapping("/team")
    public Page<AttendanceDTO> getTeamAttendance(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end,
            @RequestParam(required = false) String empId,
            Pageable pageable) {
        return attendanceService.getTeamAttendance(start, end, empId, pageable);
    }

    /**
     * GET /ems/attendance/daily?date=2025-01-15&department=DEVELOPMENT
     * All attendance records for a specific date. Department filter optional.
     */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @GetMapping("/daily")
    public List<AttendanceDTO> getDailyAttendance(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String department) {
        return attendanceService.getDailyAttendance(date, department);
    }

    /**
     * GET /ems/attendance/summary/{empId}?month=1&year=2025
     * Monthly summary for any employee (admin/manager).
     */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @GetMapping("/summary/{empId}")
    public AttendanceSummaryDTO getSummary(
            @PathVariable String empId,
            @RequestParam int month,
            @RequestParam int year) {
        return attendanceService.getSummary(empId, month, year);
    }
}
