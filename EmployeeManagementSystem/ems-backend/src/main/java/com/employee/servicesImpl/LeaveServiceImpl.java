package com.employee.servicesImpl;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.employee.dto.LeaveBalanceDTO;
import com.employee.dto.LeaveRequestDTO;
import com.employee.entity.Employee;
import com.employee.entity.LeaveBalance;
import com.employee.entity.LeaveRequest;
import com.employee.enums.LeaveStatus;
import com.employee.enums.LeaveType;
import com.employee.exceptions.EmployeeNotFoundException;
import com.employee.repository.EmployeeRepository;
import com.employee.repository.HolidayCalendarRepository;
import com.employee.repository.LeaveBalanceRepository;
import com.employee.repository.LeaveRequestRepository;
import com.employee.services.AuditService;
import com.employee.services.LeaveCalculationService;
import com.employee.services.LeaveService;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class LeaveServiceImpl implements LeaveService {

    private final LeaveRequestRepository  leaveRepo;
    private final LeaveBalanceRepository  balanceRepo;
    private final EmployeeRepository      employeeRepo;
    private final HolidayCalendarRepository holidayRepo;
    private final LeaveCalculationService calcService;
    private final AuditService            auditService;

    // ── Submit leave ───────────────────────────────────────────────────────────
    @Override
    @Transactional
    public LeaveRequestDTO submitLeave(String empId, LeaveRequestDTO dto) {
        Employee emp = getActive(empId);

        if (dto.getStartDate().isBefore(LocalDate.now()))
            throw new IllegalArgumentException("Start date cannot be in the past.");
        if (dto.getEndDate().isBefore(dto.getStartDate()))
            throw new IllegalArgumentException("End date must be on or after start date.");
        if (leaveRepo.countOverlapping(empId, dto.getStartDate(), dto.getEndDate()) > 0)
            throw new IllegalStateException("You already have a leave request overlapping these dates.");

        int days = countWorkingDays(dto.getStartDate(), dto.getEndDate());
        if (days == 0)
            throw new IllegalArgumentException("Selected date range falls entirely on weekends or public holidays.");

        // Balance check — only for leave types that consume from a balance
        if (dto.getLeaveType() == LeaveType.ANNUAL ||
            dto.getLeaveType() == LeaveType.SICK   ||
            dto.getLeaveType() == LeaveType.CASUAL) {

            LeaveBalanceDTO balance = getBalance(empId);
            int remaining = switch (dto.getLeaveType()) {
                case ANNUAL -> balance.getAnnualRemaining();
                case SICK   -> balance.getSickRemaining();
                case CASUAL -> balance.getCasualRemaining();
                default     -> Integer.MAX_VALUE;
            };
            if (days > remaining)
                throw new IllegalArgumentException(
                        "Insufficient balance. Requested: " + days + " working days. " +
                        "Available: " + remaining + " day(s).");
        }

        LeaveRequest req = LeaveRequest.builder()
                .employee(emp).leaveType(dto.getLeaveType())
                .startDate(dto.getStartDate()).endDate(dto.getEndDate())
                .daysRequested(days).reason(dto.getReason())
                .status(LeaveStatus.PENDING).build();

        auditService.log(empId, "SUBMIT_LEAVE",
                dto.getLeaveType() + " leave " + dto.getStartDate() + " to " + dto.getEndDate()
                + " (" + days + " working days)");

        return toDTO(leaveRepo.save(req));
    }

    // ── Cancel leave ───────────────────────────────────────────────────────────
    @Override
    @Transactional
    public LeaveRequestDTO cancelLeave(String empId, Long id) {
        LeaveRequest req = leaveRepo.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Leave request not found: " + id));
        if (!req.getEmployee().getEmpId().equals(empId))
            throw new IllegalStateException("You can only cancel your own leave requests.");
        if (req.getStatus() != LeaveStatus.PENDING)
            throw new IllegalStateException("Only PENDING requests can be cancelled.");
        req.setStatus(LeaveStatus.CANCELLED);
        auditService.log(empId, "CANCEL_LEAVE", "Cancelled leave request id=" + id);
        return toDTO(leaveRepo.save(req));
    }

    // ── Review ─────────────────────────────────────────────────────────────────
    @Override
    @Transactional
    public LeaveRequestDTO reviewLeave(Long id, LeaveStatus action,
                                        String reviewedBy, String reviewNotes) {
        if (action != LeaveStatus.APPROVED && action != LeaveStatus.REJECTED)
            throw new IllegalArgumentException("Action must be APPROVED or REJECTED.");

        LeaveRequest req = leaveRepo.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Leave request not found: " + id));

        if (req.getStatus() != LeaveStatus.PENDING)
            throw new IllegalStateException("Only PENDING requests can be reviewed.");

        // Self-approval prevention
        if (req.getEmployee().getEmpId().equals(reviewedBy))
            throw new IllegalStateException(
                "You cannot review your own leave request. Another Admin or Manager must approve it.");

        req.setStatus(action);
        req.setReviewedBy(reviewedBy);
        req.setReviewedAt(LocalDateTime.now());
        req.setReviewNotes(reviewNotes);

        if (action == LeaveStatus.APPROVED)
            deductBalance(req.getEmployee().getEmpId(), req.getLeaveType(),
                    req.getDaysRequested(), req.getStartDate().getYear());

        auditService.log(reviewedBy, action.name() + "_LEAVE",
                action.name() + " leave id=" + id + " for " + req.getEmployee().getEmpId()
                + " (" + req.getDaysRequested() + " days)");

        return toDTO(leaveRepo.save(req));
    }

    // ── Balance ────────────────────────────────────────────────────────────────
    /**
     * Single unified balance method.
     * Previously had getMyBalance() + getBalance() doing the same thing — removed duplication.
     * Use: getBalance(auth.getName()) for self, getBalance(anyEmpId) for admin.
     *
     * Recalculates accrual on every call so the balance is always up to date
     * as months pass without requiring a nightly scheduler.
     */
    @Override
    @Transactional
    public LeaveBalanceDTO getBalance(String empId) {
        int year      = LocalDate.now().getYear();
        int prevYear  = year - 1;
        Employee emp  = getActive(empId);

        LeaveBalance existing = balanceRepo.findByEmployeeEmpIdAndYear(empId, year).orElse(null);
        LeaveBalance prev     = balanceRepo.findByEmployeeEmpIdAndYear(empId, prevYear).orElse(null);

        // Recompute to pick up new months as the year progresses
        LeaveBalance balance = calcService.compute(emp, year, existing, prev);
        balance = balanceRepo.save(balance);

        // Annual accrued this year (excluding carry-forward) for display
        int annualAccruedThisYear = balance.getAnnualTotal() - balance.getAnnualCarriedForward();

        // Helpful note for UI: next accrual month
        int monthsWorked = calcService.computeMonthsWorkedInYear(
                emp.getDateOfJoin(), year, LocalDate.now());
        String nextAccrualNote = monthsWorked < 12
                ? "Accruing 1.25 days/month. "
                  + "Balance after next month: "
                  + (int) Math.floor((monthsWorked + 1) * 1.25) + " days accrued"
                : "Full year accrual reached (15 days)";

        return LeaveBalanceDTO.builder()
                .empId(emp.getEmpId())
                .employeeName(emp.getName())
                .year(year)
                .annualTotal(balance.getAnnualTotal())
                .annualUsed(balance.getAnnualUsed())
                .annualRemaining(balance.getRemainingAnnual())
                .annualCarriedForward(balance.getAnnualCarriedForward())
                .annualAccruedThisYear(annualAccruedThisYear)
                .sickTotal(balance.getSickTotal())
                .sickUsed(balance.getSickUsed())
                .sickRemaining(balance.getRemainingSick())
                .casualTotal(balance.getCasualTotal())
                .casualUsed(balance.getCasualUsed())
                .casualRemaining(balance.getRemainingCasual())
                .unpaidUsed(balance.getUnpaidUsed())
                .accrualNote(nextAccrualNote)
                .build();
    }

    // ── Queries ────────────────────────────────────────────────────────────────
    @Override public Page<LeaveRequestDTO> getMyLeaves(String empId, Pageable pageable) {
        return leaveRepo.findByEmployeeEmpIdOrderByCreatedAtDesc(empId, pageable).map(this::toDTO);
    }
    @Override public Page<LeaveRequestDTO> getPendingLeaves(Pageable pageable) {
        return leaveRepo.findByStatusOrderByCreatedAtAsc(LeaveStatus.PENDING, pageable).map(this::toDTO);
    }
    @Override public Page<LeaveRequestDTO> getAllLeaves(String empId, LeaveStatus status, Pageable pageable) {
        return leaveRepo.findAllFiltered(empId, status, pageable).map(this::toDTO);
    }

    // ── Private helpers ────────────────────────────────────────────────────────
    private Employee getActive(String empId) {
        Employee e = employeeRepo.findByEmpIdAndIsEmployeeActiveTrue(empId);
        if (e == null) throw new EmployeeNotFoundException("Employee not found: " + empId);
        return e;
    }

    private int countWorkingDays(LocalDate start, LocalDate end) {
        Set<LocalDate> holidays = holidayRepo
                .findByHolidayDateBetweenOrderByHolidayDateAsc(start, end)
                .stream().map(h -> h.getHolidayDate()).collect(Collectors.toSet());
        int count = 0;
        LocalDate cur = start;
        while (!cur.isAfter(end)) {
            DayOfWeek dow = cur.getDayOfWeek();
            if (dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY && !holidays.contains(cur)) count++;
            cur = cur.plusDays(1);
        }
        return count;
    }

    @Transactional
    private void deductBalance(String empId, LeaveType type, int days, int year) {
        Employee emp = getActive(empId);
        LeaveBalance bal = balanceRepo.findByEmployeeEmpIdAndYear(empId, year)
                .orElseGet(() -> {
                    LeaveBalance prev = balanceRepo.findByEmployeeEmpIdAndYear(empId, year - 1).orElse(null);
                    return balanceRepo.save(calcService.compute(emp, year, null, prev));
                });
        switch (type) {
            case ANNUAL -> bal.setAnnualUsed(bal.getAnnualUsed() + days);
            case SICK   -> bal.setSickUsed(bal.getSickUsed() + days);
            case CASUAL -> bal.setCasualUsed(bal.getCasualUsed() + days);
            case UNPAID -> bal.setUnpaidUsed(bal.getUnpaidUsed() + days);
            default     -> {}
        }
        balanceRepo.save(bal);
    }

    private LeaveRequestDTO toDTO(LeaveRequest r) {
        return LeaveRequestDTO.builder()
                .id(r.getId()).empId(r.getEmployee().getEmpId())
                .employeeName(r.getEmployee().getName())
                .department(r.getEmployee().getDepartment())
                .leaveType(r.getLeaveType()).startDate(r.getStartDate())
                .endDate(r.getEndDate()).daysRequested(r.getDaysRequested())
                .reason(r.getReason()).status(r.getStatus())
                .reviewedBy(r.getReviewedBy()).reviewedAt(r.getReviewedAt())
                .reviewNotes(r.getReviewNotes()).createdAt(r.getCreatedAt()).build();
    }
}