package com.employee.servicesImpl;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.employee.dto.LeaveBalanceDTO;
import com.employee.dto.LeaveRequestDTO;
import com.employee.entity.Attendance;
import com.employee.entity.Employee;
import com.employee.entity.LeaveBalance;
import com.employee.entity.LeaveRequest;
import com.employee.enums.AttendanceStatus;
import com.employee.enums.LeaveStatus;
import com.employee.enums.LeaveType;
import com.employee.exceptions.EmployeeNotFoundException;
import com.employee.repository.AttendanceRepository;
import com.employee.repository.EmployeeRepository;
import com.employee.repository.HolidayCalendarRepository;
import com.employee.repository.LeaveBalanceRepository;
import com.employee.repository.LeaveRequestRepository;
import com.employee.services.AuditService;
import com.employee.services.LeaveCalculationService;
import com.employee.services.LeaveService;
import com.employee.services.PushNotificationService;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class LeaveServiceImpl implements LeaveService {

    private final LeaveRequestRepository leaveRepo;
    private final LeaveBalanceRepository balanceRepo;
    private final EmployeeRepository employeeRepo;
    private final HolidayCalendarRepository holidayRepo;
    private final AttendanceRepository attendanceRepo;
    private final LeaveCalculationService    calcService;
    private final AuditService               auditService;
    private final PushNotificationService    pushService;

    // ── Submit leave ───────────────────────────────────────────────────────────
    @Override
    @Transactional
    public LeaveRequestDTO submitLeave(String empId, LeaveRequestDTO dto) {
        Employee emp = getActive(empId);

        if (dto.getStartDate().isBefore(LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"))))
            throw new IllegalArgumentException("Start date cannot be in the past.");
        if (dto.getEndDate().isBefore(dto.getStartDate()))
            throw new IllegalArgumentException("End date must be on or after start date.");
        if (leaveRepo.countOverlapping(empId, dto.getStartDate(), dto.getEndDate()) > 0)
            throw new IllegalStateException("You already have a leave request overlapping these dates.");

        int days = countWorkingDays(dto.getStartDate(), dto.getEndDate());
        if (days == 0)
            throw new IllegalArgumentException("Selected date range falls entirely on weekends or public holidays.");

        // Gender-gated leave types
        String gender = emp.getGender() != null ? emp.getGender().toUpperCase() : "";
        LeaveType lt = dto.getLeaveType();
        if (lt == LeaveType.MATERNITY && "MALE".equals(gender))
            throw new IllegalArgumentException("Maternity leave is not applicable for male employees.");
        if (lt == LeaveType.PATERNITY && !"MALE".equals(gender))
            throw new IllegalArgumentException("Paternity leave is only applicable for male employees.");

        if (lt != LeaveType.UNPAID) {
            LeaveBalanceDTO balance = getBalance(empId);
            Integer remaining = switch (lt) {
                case ANNUAL -> balance.getAnnualRemaining();
                case SICK -> balance.getSickRemaining();
                case CASUAL -> balance.getCasualRemaining();
                case SICK_CASUAL -> balance.getSickCasualRemaining();
                case MATERNITY -> balance.getMaternityRemaining();
                case PATERNITY -> balance.getPaternityRemaining();
                case COMPENSATORY -> balance.getCompOffRemaining();
                default -> Integer.MAX_VALUE;
            };
            if (remaining != null && days > remaining)
                throw new IllegalArgumentException(
                        "Insufficient " + lt.name().toLowerCase() + " balance. "
                                + "Requested: " + days + " working days. "
                                + "Available: " + remaining + " day(s).");
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
            throw new IllegalStateException(
                "Only PENDING leave requests can be cancelled. " +
                "This request has already been " + req.getStatus() + ".");
        req.setStatus(LeaveStatus.CANCELLED);
        removeOnLeaveAttendance(empId, req.getStartDate(), req.getEndDate());
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
            throw new IllegalStateException(
                "Only PENDING leave requests can be reviewed. " +
                "This request has already been " + req.getStatus() + ".");

        // Self-approval prevention
        if (req.getEmployee().getEmpId().equals(reviewedBy))
            throw new IllegalStateException(
                    "You cannot review your own leave request. Another Admin or Manager must approve it.");

        if (action == LeaveStatus.APPROVED) {
            // Guard against race-condition double-approval: another request for the
            // same employee and overlapping dates may have been approved concurrently.
            long conflicts = leaveRepo.countConflictingApproved(
                    req.getEmployee().getEmpId(),
                    req.getStartDate(), req.getEndDate(), id);
            if (conflicts > 0)
                throw new IllegalStateException(
                        "Cannot approve: an approved leave already exists for these dates.");
            deductBalance(req.getEmployee().getEmpId(), req.getLeaveType(),
                    req.getDaysRequested(), req.getStartDate().getYear());
            createOnLeaveAttendance(req.getEmployee(), req.getStartDate(), req.getEndDate());
        }

        req.setStatus(action);
        req.setReviewedBy(reviewedBy);
        req.setReviewedAt(LocalDateTime.now());
        req.setReviewNotes(reviewNotes);

        auditService.log(reviewedBy, action.name() + "_LEAVE",
                action.name() + " leave id=" + id + " for " + req.getEmployee().getEmpId()
                        + " (" + req.getDaysRequested() + " days)");

        LeaveRequestDTO result = toDTO(leaveRepo.save(req));
        pushService.sendLeaveStatusNotification(
                req.getEmployee().getEmpId(),
                action.name(),
                req.getLeaveType().name(),
                reviewNotes,
                req.getId());
        return result;
    }

    // ── Admin grant leave ──────────────────────────────────────────────────────
    @Override
    @Transactional
    public LeaveRequestDTO grantLeave(String adminEmpId, String targetEmpId, LeaveRequestDTO dto) {
        Employee emp = getActive(targetEmpId);

        if (dto.getStartDate() == null || dto.getEndDate() == null)
            throw new IllegalArgumentException("Start date and end date are required.");
        if (dto.getEndDate().isBefore(dto.getStartDate()))
            throw new IllegalArgumentException("End date must be on or after start date.");

        // Block if an APPROVED leave already covers these dates
        long approvedConflicts = leaveRepo.countConflictingApproved(
                targetEmpId, dto.getStartDate(), dto.getEndDate(), -1L);
        if (approvedConflicts > 0)
            throw new IllegalStateException(
                    "Cannot grant leave: an approved leave already exists for these dates.");

        int days = countWorkingDays(dto.getStartDate(), dto.getEndDate());
        if (days == 0)
            throw new IllegalArgumentException(
                    "Selected date range falls entirely on weekends or public holidays.");

        // Gender-gated leave types
        String gender = emp.getGender() != null ? emp.getGender().toUpperCase() : "";
        LeaveType lt = dto.getLeaveType();
        if (lt == LeaveType.MATERNITY && "MALE".equals(gender))
            throw new IllegalArgumentException("Maternity leave is not applicable for male employees.");
        if (lt == LeaveType.PATERNITY && !"MALE".equals(gender))
            throw new IllegalArgumentException("Paternity leave is only applicable for male employees.");

        // Auto-reject any PENDING requests that overlap — they would become orphaned
        leaveRepo.findOverlappingPending(targetEmpId, dto.getStartDate(), dto.getEndDate())
                .forEach(pending -> {
                    pending.setStatus(LeaveStatus.REJECTED);
                    pending.setReviewedBy(adminEmpId);
                    pending.setReviewedAt(LocalDateTime.now());
                    pending.setReviewNotes("Superseded by admin-granted leave.");
                    leaveRepo.save(pending);
                    auditService.log(adminEmpId, "AUTO_REJECT_LEAVE",
                            "Auto-rejected pending leave id=" + pending.getId()
                                    + " for " + targetEmpId + " (superseded by grant)");
                });

        // Deduct balance (skip for UNPAID)
        if (lt != LeaveType.UNPAID)
            deductBalance(targetEmpId, lt, days, dto.getStartDate().getYear());

        LeaveRequest granted = LeaveRequest.builder()
                .employee(emp)
                .leaveType(lt)
                .startDate(dto.getStartDate())
                .endDate(dto.getEndDate())
                .daysRequested(days)
                .reason(dto.getReason() != null ? dto.getReason() : "Granted by admin")
                .status(LeaveStatus.APPROVED)
                .reviewedBy(adminEmpId)
                .reviewedAt(LocalDateTime.now())
                .reviewNotes("Leave granted directly by admin.")
                .build();

        auditService.log(adminEmpId, "GRANT_LEAVE",
                lt + " leave granted for " + targetEmpId
                        + " from " + dto.getStartDate() + " to " + dto.getEndDate()
                        + " (" + days + " working days)");

        LeaveRequestDTO result = toDTO(leaveRepo.save(granted));
        createOnLeaveAttendance(emp, dto.getStartDate(), dto.getEndDate());
        return result;
    }

    // ── Balance ────────────────────────────────────────────────────────────────
    /**
     * Single unified balance method.
     * Previously had getMyBalance() + getBalance() doing the same thing — removed
     * duplication.
     * Use: getBalance(auth.getName()) for self, getBalance(anyEmpId) for admin.
     *
     * Recalculates accrual on every call so the balance is always up to date
     * as months pass without requiring a nightly scheduler.
     */
    @Override
    @Transactional
    public LeaveBalanceDTO getBalance(String empId) {
        int year = LocalDate.now(java.time.ZoneId.of("Asia/Kolkata")).getYear();
        int prevYear = year - 1;
        Employee emp = getActive(empId);

        LeaveBalance existing = balanceRepo.findByEmployeeEmpIdAndYear(empId, year).orElse(null);
        LeaveBalance prev = balanceRepo.findByEmployeeEmpIdAndYear(empId, prevYear).orElse(null);

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

        // Determine gender-gated leave fields
        // MALE      → paternity only (maternity fields omitted/null for frontend)
        // FEMALE/OTHER/UNKNOWN → maternity only (paternity fields omitted/null)
        String gender = emp.getGender() != null ? emp.getGender().toUpperCase() : "";
        boolean isMale = "MALE".equals(gender);

        return LeaveBalanceDTO.builder()
                .empId(emp.getEmpId())
                .employeeName(emp.getName())
                .year(year)
                // Annual / Earned
                .annualTotal(balance.getAnnualTotal())
                .annualUsed(balance.getAnnualUsed())
                .annualRemaining(balance.getRemainingAnnual())
                .annualCarriedForward(balance.getAnnualCarriedForward())
                .annualAccruedThisYear(annualAccruedThisYear)
                // Sick
                .sickTotal(balance.getSickTotal())
                .sickUsed(balance.getSickUsed())
                .sickRemaining(balance.getRemainingSick())
                // Casual
                .casualTotal(balance.getCasualTotal())
                .casualUsed(balance.getCasualUsed())
                .casualRemaining(balance.getRemainingCasual())
                // Sick / Casual combined
                .sickCasualTotal(balance.getSickCasualTotal() != null && balance.getSickCasualTotal() > 0
                        ? balance.getSickCasualTotal() : LeaveCalculationService.SICK_CASUAL_FULL_YEAR)
                .sickCasualUsed(balance.getSickCasualUsed() != null ? balance.getSickCasualUsed() : 0)
                .sickCasualRemaining(balance.getRemainingSickCasual())
                // Maternity — only for non-male employees
                .maternityTotal(isMale ? null : balance.getMaternityTotal())
                .maternityUsed(isMale ? null : balance.getMaternityUsed())
                .maternityRemaining(isMale ? null : balance.getRemainingMaternity())
                // Paternity — only for male employees
                .paternityTotal(isMale ? balance.getPaternityTotal() : null)
                .paternityUsed(isMale ? balance.getPaternityUsed() : null)
                .paternityRemaining(isMale ? balance.getRemainingPaternity() : null)
                // Comp-off
                .compOffEarned(balance.getCompOffEarned())
                .compOffUsed(balance.getCompOffUsed())
                .compOffRemaining(balance.getRemainingCompOff())
                // Unpaid
                .unpaidUsed(balance.getUnpaidUsed())
                .accrualNote(nextAccrualNote)
                .build();
    }

    // ── Queries ────────────────────────────────────────────────────────────────
    @Override
    public Page<LeaveRequestDTO> getMyLeaves(String empId, Pageable pageable) {
        return leaveRepo.findByEmployeeEmpIdOrderByCreatedAtDesc(empId, pageable).map(this::toDTO);
    }

    /**
     * ADMIN — sees ALL pending requests across the organisation.
     * MANAGER — sees only pending requests from employees in their own department.
     *
     * @param reviewerEmpId empId of the logged-in Admin/Manager
     */
    @Override
    public Page<LeaveRequestDTO> getPendingLeaves(String reviewerEmpId, Pageable pageable) {
        Employee reviewer = getActive(reviewerEmpId);
        boolean isAdmin = reviewer.getRoles() != null && reviewer.getRoles().stream()
                .anyMatch(ur -> ur.getRole() != null && ur.getRole().getRole() != null
                        && "ADMIN".equalsIgnoreCase(ur.getRole().getRole().name()));

        if (isAdmin) {
            // Admin: unrestricted — see every pending leave in the system
            return leaveRepo.findByStatusOrderByCreatedAtAsc(LeaveStatus.PENDING, pageable)
                    .map(this::toDTO);
        } else {
            // Manager: scoped to their own department
            String dept = reviewer.getDepartment();
            return leaveRepo.findPendingByDepartment(dept, pageable).map(this::toDTO);
        }
    }

    @Override
    public Page<LeaveRequestDTO> getAllLeaves(String empId, LeaveStatus status, Pageable pageable) {
        return leaveRepo.findAllFiltered(empId, status, pageable).map(this::toDTO);
    }

    // ── Recalculate approved leaves when a new holiday is added ───────────────
    @Override
    @Transactional
    public void recalculateAffectedLeaves(LocalDate newHolidayDate) {
        leaveRepo.findApprovedLeavesSpanningDate(newHolidayDate).forEach(req -> {
            int oldDays = req.getDaysRequested();
            // countWorkingDays re-queries the holiday table — the new holiday is already
            // saved in the same transaction so it will be included in the count.
            int newDays = countWorkingDays(req.getStartDate(), req.getEndDate());
            int diff = oldDays - newDays;
            if (diff > 0 && req.getLeaveType() != LeaveType.UNPAID) {
                req.setDaysRequested(newDays);
                leaveRepo.save(req);
                refundBalance(req.getEmployee().getEmpId(),
                        req.getLeaveType(), diff, req.getStartDate().getYear());
                auditService.log("SYSTEM", "LEAVE_RECALCULATED",
                        "Leave id=" + req.getId() + " for " + req.getEmployee().getEmpId()
                                + " adjusted " + oldDays + "→" + newDays
                                + " days (new holiday: " + newHolidayDate + ")");
            }
        });
    }

    // ── Private helpers ────────────────────────────────────────────────────────
    private Employee getActive(String empId) {
        Employee e = employeeRepo.findByEmpIdAndIsEmployeeActiveTrue(empId);
        if (e == null)
            throw new EmployeeNotFoundException("Employee not found: " + empId);
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
            if (dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY && !holidays.contains(cur))
                count++;
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
            case SICK -> bal.setSickUsed(bal.getSickUsed() + days);
            case CASUAL -> bal.setCasualUsed(bal.getCasualUsed() + days);
            case SICK_CASUAL -> bal.setSickCasualUsed(nullSafe(bal.getSickCasualUsed()) + days);
            case UNPAID -> bal.setUnpaidUsed(bal.getUnpaidUsed() + days);
            case MATERNITY -> bal.setMaternityUsed(nullSafe(bal.getMaternityUsed()) + days);
            case PATERNITY -> bal.setPaternityUsed(nullSafe(bal.getPaternityUsed()) + days);
            case COMPENSATORY -> bal.setCompOffUsed(nullSafe(bal.getCompOffUsed()) + days);
        }
        balanceRepo.save(bal);
    }

    @Transactional
    private void refundBalance(String empId, LeaveType type, int days, int year) {
        Employee emp = getActive(empId);
        LeaveBalance bal = balanceRepo.findByEmployeeEmpIdAndYear(empId, year)
                .orElseGet(() -> {
                    LeaveBalance prev = balanceRepo.findByEmployeeEmpIdAndYear(empId, year - 1).orElse(null);
                    return balanceRepo.save(calcService.compute(emp, year, null, prev));
                });
        switch (type) {
            case ANNUAL -> bal.setAnnualUsed(Math.max(0, bal.getAnnualUsed() - days));
            case SICK -> bal.setSickUsed(Math.max(0, bal.getSickUsed() - days));
            case CASUAL -> bal.setCasualUsed(Math.max(0, bal.getCasualUsed() - days));
            case SICK_CASUAL -> bal.setSickCasualUsed(Math.max(0, nullSafe(bal.getSickCasualUsed()) - days));
            case UNPAID -> bal.setUnpaidUsed(Math.max(0, bal.getUnpaidUsed() - days));
            case MATERNITY -> bal.setMaternityUsed(Math.max(0, nullSafe(bal.getMaternityUsed()) - days));
            case PATERNITY -> bal.setPaternityUsed(Math.max(0, nullSafe(bal.getPaternityUsed()) - days));
            case COMPENSATORY -> bal.setCompOffUsed(Math.max(0, nullSafe(bal.getCompOffUsed()) - days));
        }
        balanceRepo.save(bal);
    }

    /**
     * For every non-weekend day in [start, end], create or overwrite the
     * attendance record with ON_LEAVE. This ensures the attendance calendar
     * shows ON_LEAVE even when the day falls on a public holiday.
     */
    private void createOnLeaveAttendance(Employee emp, LocalDate start, LocalDate end) {
        LocalDate cur = start;
        while (!cur.isAfter(end)) {
            DayOfWeek dow = cur.getDayOfWeek();
            // Include public holidays — leave takes priority over holiday marking
            if (dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY) {
                final LocalDate date = cur;
                Attendance rec = attendanceRepo
                        .findByEmployeeEmpIdAndAttendanceDate(emp.getEmpId(), date)
                        .map(existing -> {
                            existing.setStatus(AttendanceStatus.ON_LEAVE);
                            existing.setNotes("On approved leave");
                            existing.setRecordedBy("SYSTEM");
                            return existing;
                        })
                        .orElse(Attendance.builder()
                                .employee(emp)
                                .attendanceDate(date)
                                .status(AttendanceStatus.ON_LEAVE)
                                .notes("On approved leave")
                                .recordedBy("SYSTEM")
                                .build());
                attendanceRepo.save(rec);
            }
            cur = cur.plusDays(1);
        }
    }

    /**
     * Removes SYSTEM-created ON_LEAVE records when a leave is cancelled.
     * Only removes records the system created — manual check-ins are preserved.
     */
    private void removeOnLeaveAttendance(String empId, LocalDate start, LocalDate end) {
        LocalDate cur = start;
        while (!cur.isAfter(end)) {
            DayOfWeek dow = cur.getDayOfWeek();
            if (dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY) {
                final LocalDate date = cur;
                attendanceRepo.findByEmployeeEmpIdAndAttendanceDate(empId, date)
                        .filter(rec -> rec.getStatus() == AttendanceStatus.ON_LEAVE
                                && "SYSTEM".equals(rec.getRecordedBy()))
                        .ifPresent(attendanceRepo::delete);
            }
            cur = cur.plusDays(1);
        }
    }

    private LeaveRequestDTO toDTO(LeaveRequest r) {
        return LeaveRequestDTO.builder()
                .id(r.getId()).empId(r.getEmployee().getEmpId())
                .employeeName(r.getEmployee().getName())
                .department(r.getEmployee().getDepartment())
                .profileImage(r.getEmployee().getProfileImage())
                .leaveType(r.getLeaveType()).startDate(r.getStartDate())
                .endDate(r.getEndDate()).daysRequested(r.getDaysRequested())
                .reason(r.getReason()).status(r.getStatus())
                .reviewedBy(r.getReviewedBy()).reviewedAt(r.getReviewedAt())
                .reviewNotes(r.getReviewNotes()).createdAt(r.getCreatedAt()).build();
    }

    /** Null-safe unbox — treats null DB columns as 0. */
    private int nullSafe(Integer value) {
        return value != null ? value : 0;
    }
}
