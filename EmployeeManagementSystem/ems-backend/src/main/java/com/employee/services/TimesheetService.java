package com.employee.services;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.employee.dto.TimesheetDTO;
import com.employee.enums.TimesheetStatus;

public interface TimesheetService {

    // ── Employee ───────────────────────────────────────────────────────────────
    TimesheetDTO saveEntry(String empId, TimesheetDTO dto);
    TimesheetDTO submitWeek(String empId, LocalDate weekStartDate);
    List<TimesheetDTO> getCurrentWeek(String empId);
    List<TimesheetDTO> getWeek(String empId, LocalDate weekStartDate);
    Page<TimesheetDTO> getMyTimesheets(String empId, LocalDate from, LocalDate to, Pageable pageable);

    void deleteEntry(String empId, Long id);

    // ── Admin / Manager ────────────────────────────────────────────────────────
    TimesheetDTO reviewEntry(Long id, TimesheetStatus action,
                             String reviewedBy, String reviewNotes);
    Page<TimesheetDTO> getTeamTimesheets(String empId, TimesheetStatus status, LocalDate from, LocalDate to, Pageable pageable);
    Page<TimesheetDTO> getPendingTimesheets(Pageable pageable);
}
