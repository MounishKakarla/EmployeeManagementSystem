package com.employee.services;

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
    Page<LeaveRequestDTO> getPendingLeaves(Pageable pageable);
    Page<LeaveRequestDTO> getAllLeaves(String empId, LeaveStatus status, Pageable pageable);
}