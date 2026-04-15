package com.employee.controllers;

import java.time.LocalDate;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.employee.dto.TimesheetDTO;
import com.employee.enums.TimesheetStatus;
import com.employee.services.TimesheetService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/ems/timesheets")
@RequiredArgsConstructor
public class TimesheetController {

    private final TimesheetService timesheetService;

    // ── Employee self-service ──────────────────────────────────────────────────

    /**
     * GET /ems/timesheets/current-week
     * Returns all project entries for the authenticated employee's current ISO week.
     */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','EMPLOYEE')")
    @GetMapping("/current-week")
    public ResponseEntity<?> getCurrentWeek(Authentication auth) {
        return ResponseEntity.ok(timesheetService.getCurrentWeek(auth.getName()));
    }

    /**
     * POST /ems/timesheets
     * Save (create or update) a single project entry for a week.
     */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','EMPLOYEE')")
    @PostMapping
    public ResponseEntity<TimesheetDTO> saveEntry(
            Authentication auth, @RequestBody TimesheetDTO dto) {
        return ResponseEntity.ok(timesheetService.saveEntry(auth.getName(), dto));
    }

    /**
     * POST /ems/timesheets/submit?weekStartDate=2025-01-06
     * Submit all DRAFT entries for the given week.
     */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','EMPLOYEE')")
    @PostMapping("/submit")
    public ResponseEntity<TimesheetDTO> submitWeek(
            Authentication auth,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStartDate) {
        return ResponseEntity.ok(timesheetService.submitWeek(auth.getName(), weekStartDate));
    }

    /**
     * GET /ems/timesheets/my
     * Paginated own timesheet history.
     */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','EMPLOYEE')")
    @GetMapping("/my")
    public Page<TimesheetDTO> getMyTimesheets(Authentication auth, Pageable pageable) {
        return timesheetService.getMyTimesheets(auth.getName(), pageable);
    }

    // ── Admin / Manager ────────────────────────────────────────────────────────

    /**
     * GET /ems/timesheets/pending
     * All SUBMITTED timesheets awaiting approval.
     */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @GetMapping("/pending")
    public Page<TimesheetDTO> getPending(Pageable pageable) {
        return timesheetService.getPendingTimesheets(pageable);
    }

    /**
     * GET /ems/timesheets/team?empId=TT0001&status=SUBMITTED
     * Full team timesheet view with optional filters.
     */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @GetMapping("/team")
    public Page<TimesheetDTO> getTeam(
            @RequestParam(required = false) String empId,
            @RequestParam(required = false) TimesheetStatus status,
            Pageable pageable) {
        return timesheetService.getTeamTimesheets(empId, status, pageable);
    }

    /**
     * PUT /ems/timesheets/{id}/review?action=APPROVED
     * Approve or reject a submitted timesheet entry.
     */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @PutMapping("/{id}/review")
    public ResponseEntity<TimesheetDTO> review(
            Authentication auth,
            @PathVariable Long id,
            @RequestParam TimesheetStatus action,
            @RequestBody(required = false) TimesheetDTO body) {
        String notes = (body != null) ? body.getReviewNotes() : null;
        return ResponseEntity.ok(
                timesheetService.reviewEntry(id, action, auth.getName(), notes));
    }
}
