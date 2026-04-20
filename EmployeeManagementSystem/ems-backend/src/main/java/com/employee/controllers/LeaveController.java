package com.employee.controllers;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.employee.dto.LeaveBalanceDTO;
import com.employee.dto.LeaveRequestDTO;
import com.employee.enums.LeaveStatus;
import com.employee.services.LeaveService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/ems/leaves")
@RequiredArgsConstructor
public class LeaveController {

    private final LeaveService leaveService;

    // ── Employee self-service ─────────────────────────────────────────────────

    /** POST /ems/leaves */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','EMPLOYEE')")
    @PostMapping
    public ResponseEntity<LeaveRequestDTO> submit(Authentication auth,
                                                   @RequestBody LeaveRequestDTO dto) {
        return ResponseEntity.ok(leaveService.submitLeave(auth.getName(), dto));
    }

    /** DELETE /ems/leaves/{id} — cancel own pending request */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','EMPLOYEE')")
    @DeleteMapping("/{id}")
    public ResponseEntity<LeaveRequestDTO> cancel(Authentication auth, @PathVariable Long id) {
        return ResponseEntity.ok(leaveService.cancelLeave(auth.getName(), id));
    }

    /** GET /ems/leaves/my — own leave history */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','EMPLOYEE')")
    @GetMapping("/my")
    public Page<LeaveRequestDTO> getMyLeaves(Authentication auth, Pageable pageable) {
        return leaveService.getMyLeaves(auth.getName(), pageable);
    }

    /**
     * GET /ems/leaves/balance
     * Own balance — uses getBalance(auth.getName()).
     * Note: getMyBalance() was a duplicate of getBalance() and has been removed.
     * This single endpoint serves both employees (their own) and admin (via /balance/{empId}).
     */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','EMPLOYEE')")
    @GetMapping("/balance")
    public ResponseEntity<LeaveBalanceDTO> myBalance(Authentication auth) {
        return ResponseEntity.ok(leaveService.getBalance(auth.getName()));
    }

    // ── Admin / Manager ───────────────────────────────────────────────────────

    /** GET /ems/leaves/pending
     *
     * ADMIN  → returns all pending leaves across the organisation.
     * MANAGER → returns only pending leaves from their own department.
     */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @GetMapping("/pending")
    public Page<LeaveRequestDTO> getPending(Authentication auth, Pageable pageable) {
        return leaveService.getPendingLeaves(auth.getName(), pageable);
    }

    /** GET /ems/leaves/all?empId=TT0001&status=APPROVED */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @GetMapping("/all")
    public Page<LeaveRequestDTO> getAll(
            @RequestParam(required = false) String empId,
            @RequestParam(required = false) LeaveStatus status,
            Pageable pageable) {
        return leaveService.getAllLeaves(empId, status, pageable);
    }

    /**
     * PUT /ems/leaves/{id}/review?action=APPROVED
     * Self-approval is blocked in the service layer.
     */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @PutMapping("/{id}/review")
    public ResponseEntity<LeaveRequestDTO> review(
            Authentication auth, @PathVariable Long id,
            @RequestParam LeaveStatus action,
            @RequestBody(required = false) LeaveRequestDTO body) {
        String notes = (body != null) ? body.getReviewNotes() : null;
        return ResponseEntity.ok(leaveService.reviewLeave(id, action, auth.getName(), notes));
    }

    /** GET /ems/leaves/balance/{empId} — any employee's balance (admin/manager) */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @GetMapping("/balance/{empId}")
    public ResponseEntity<LeaveBalanceDTO> getBalance(@PathVariable String empId) {
        return ResponseEntity.ok(leaveService.getBalance(empId));
    }
}