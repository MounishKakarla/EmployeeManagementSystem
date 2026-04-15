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
    Page<TimesheetDTO> getMyTimesheets(String empId, Pageable pageable);

    // ── Admin / Manager ────────────────────────────────────────────────────────
    TimesheetDTO reviewEntry(Long id, TimesheetStatus action,
                             String reviewedBy, String reviewNotes);
    Page<TimesheetDTO> getTeamTimesheets(String empId, TimesheetStatus status, Pageable pageable);
    Page<TimesheetDTO> getPendingTimesheets(Pageable pageable);
}
