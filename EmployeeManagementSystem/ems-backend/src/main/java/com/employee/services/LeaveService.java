package com.employee.services;

import java.time.LocalDate;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.employee.dto.LeaveBalanceDTO;
import com.employee.dto.LeaveRequestDTO;
import com.employee.enums.LeaveStatus;

public interface LeaveService {

    // ── Employee self-service ──────────────────────────────────────────────────
    LeaveRequestDTO submitLeave(String empId, LeaveRequestDTO dto);
    LeaveRequestDTO cancelLeave(String empId, Long id);
    Page<LeaveRequestDTO> getMyLeaves(String empId, Pageable pageable);

    // ── Balance (single method — used by both employee and admin/manager) ──────
    // getMyBalance() was removed as a duplicate. Use getBalance() everywhere:
    //   Employee calls: getBalance(auth.getName())
    //   Admin/Manager:  getBalance(any empId)
    LeaveBalanceDTO getBalance(String empId);

    // ── Admin / Manager ────────────────────────────────────────────────────────
    LeaveRequestDTO reviewLeave(Long id, LeaveStatus action,
                                String reviewedBy, String reviewNotes);

    /**
     * Admin directly grants an approved leave for any employee.
     * Auto-rejects any overlapping PENDING requests for that employee.
     */
    LeaveRequestDTO grantLeave(String adminEmpId, String targetEmpId, LeaveRequestDTO dto);

    /**
     * Returns pending leave requests visible to the reviewer.
     * ADMIN  → all pending requests across the org.
     * MANAGER → only requests from employees in the reviewer's department.
     */
    Page<LeaveRequestDTO> getPendingLeaves(String reviewerEmpId, Pageable pageable);
    Page<LeaveRequestDTO> getAllLeaves(String empId, LeaveStatus status, Pageable pageable);

    /**
     * Called when a new holiday is added. Finds all APPROVED leaves spanning that
     * date, recalculates their working-day count (now excluding the new holiday),
     * and refunds the balance difference to each affected employee.
     */
    void recalculateAffectedLeaves(LocalDate newHolidayDate);
}