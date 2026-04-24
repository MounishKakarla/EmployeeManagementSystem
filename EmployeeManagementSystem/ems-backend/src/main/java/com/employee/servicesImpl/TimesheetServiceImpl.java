package com.employee.servicesImpl;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.employee.dto.TimesheetDTO;
import com.employee.entity.Employee;
import com.employee.entity.Timesheet;
import com.employee.enums.TimesheetStatus;
import com.employee.exceptions.EmployeeNotFoundException;
import com.employee.repository.EmployeeRepository;
import com.employee.repository.HolidayCalendarRepository;
import com.employee.repository.TimesheetRepository;
import com.employee.services.AuditService;
import com.employee.services.PushNotificationService;
import com.employee.services.TimesheetService;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TimesheetServiceImpl implements TimesheetService {

    private final TimesheetRepository       timesheetRepo;
    private final EmployeeRepository        employeeRepo;
    private final HolidayCalendarRepository holidayRepo;
    private final AuditService              auditService;
    private final PushNotificationService   pushService;

    @Override
    @Transactional
    public TimesheetDTO saveEntry(String empId, TimesheetDTO dto) {
        Employee emp = getActive(empId);
        LocalDate weekStart = toMonday(dto.getWeekStartDate());

        Timesheet ts;
        if (dto.getId() != null) {
            ts = timesheetRepo.findById(dto.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Timesheet entry not found: " + dto.getId()));
        } else {
            ts = Timesheet.builder()
                    .employee(emp)
                    .weekStartDate(weekStart)
                    .project(dto.getProject())
                    .status(TimesheetStatus.DRAFT)
                    .build();
        }

        if (ts.getStatus() == TimesheetStatus.SUBMITTED || ts.getStatus() == TimesheetStatus.APPROVED)
            throw new IllegalStateException("Cannot edit a submitted or approved timesheet.");

        if (dto.getTaskDescription() != null) ts.setTaskDescription(dto.getTaskDescription());

        Set<LocalDate> nonWorking = getWeekNonWorkingDates(weekStart);
        ts.setMondayHours(   validateHours(dto.getMondayHours(),    weekStart,             nonWorking));
        ts.setTuesdayHours(  validateHours(dto.getTuesdayHours(),   weekStart.plusDays(1), nonWorking));
        ts.setWednesdayHours(validateHours(dto.getWednesdayHours(), weekStart.plusDays(2), nonWorking));
        ts.setThursdayHours( validateHours(dto.getThursdayHours(),  weekStart.plusDays(3), nonWorking));
        ts.setFridayHours(   validateHours(dto.getFridayHours(),    weekStart.plusDays(4), nonWorking));
        ts.setSaturdayHours( orZero(dto.getSaturdayHours()));
        ts.setSundayHours(   orZero(dto.getSundayHours()));
        ts.setStatus(TimesheetStatus.DRAFT);

        TimesheetDTO result = toDTO(timesheetRepo.save(ts));
        auditService.log(empId, "SAVE_TIMESHEET_DRAFT",
                "Saved draft for week " + weekStart + " project=" + dto.getProject());
        return result;
    }

    @Override
    @Transactional
    public TimesheetDTO submitWeek(String empId, LocalDate weekStartDate) {
        LocalDate weekStart = toMonday(weekStartDate);
        List<Timesheet> entries = timesheetRepo.findByEmployeeEmpIdAndWeekStartDate(empId, weekStart);
        if (entries.isEmpty())
            throw new IllegalStateException("No timesheet entries for this week.");
        if (entries.stream().noneMatch(t -> t.getTotalHours().compareTo(BigDecimal.ZERO) > 0))
            throw new IllegalStateException("At least one project must have hours recorded.");

        entries.forEach(t -> { t.setStatus(TimesheetStatus.SUBMITTED); t.setSubmittedAt(LocalDateTime.now()); });
        timesheetRepo.saveAll(entries);

        auditService.log(empId, "SUBMIT_TIMESHEET",
                "Submitted timesheet for week " + weekStart + " (" + entries.size() + " entries)");
        return toDTO(entries.get(0));
    }

    @Override
    public List<TimesheetDTO> getCurrentWeek(String empId) {
        return getWeek(empId, LocalDate.now());
    }

    @Override
    public List<TimesheetDTO> getWeek(String empId, LocalDate weekStartDate) {
        return timesheetRepo.findByEmployeeEmpIdAndWeekStartDate(empId, toMonday(weekStartDate))
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Override
    public Page<TimesheetDTO> getMyTimesheets(String empId, Pageable pageable) {
        return timesheetRepo.findByEmployeeEmpIdOrderByWeekStartDateDesc(empId, pageable).map(this::toDTO);
    }

    @Override
    @Transactional
    public TimesheetDTO reviewEntry(Long id, TimesheetStatus action,
                                     String reviewedBy, String reviewNotes) {
        if (action != TimesheetStatus.APPROVED && action != TimesheetStatus.REJECTED)
            throw new IllegalArgumentException("Action must be APPROVED or REJECTED.");

        Timesheet ts = timesheetRepo.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Timesheet not found: " + id));

        if (ts.getStatus() != TimesheetStatus.SUBMITTED)
            throw new IllegalStateException("Only SUBMITTED entries can be reviewed.");

        // ── SELF-APPROVAL PREVENTION ───────────────────────────────────────
        // An admin/manager cannot approve or reject their own timesheet.
        // Another admin or manager must review it.
        if (ts.getEmployee().getEmpId().equals(reviewedBy)) {
            throw new IllegalStateException(
                "You cannot review your own timesheet. " +
                "Another Admin or Manager must approve or reject it.");
        }

        ts.setStatus(action);
        ts.setApprovedBy(reviewedBy);
        ts.setApprovedAt(LocalDateTime.now());
        ts.setReviewNotes(reviewNotes);

        auditService.log(reviewedBy, action.name() + "_TIMESHEET",
                action.name() + " timesheet id=" + id + " for " +
                ts.getEmployee().getEmpId() + " week=" + ts.getWeekStartDate());

        TimesheetDTO result = toDTO(timesheetRepo.save(ts));
        pushService.sendTimesheetStatusNotification(
                ts.getEmployee().getEmpId(),
                action.name(),
                ts.getWeekStartDate().toString(),
                reviewNotes);
        return result;
    }

    @Override
    public Page<TimesheetDTO> getTeamTimesheets(String empId, TimesheetStatus status, Pageable pageable) {
        return timesheetRepo.findTeamTimesheets(empId, status, pageable).map(this::toDTO);
    }

    @Override
    public Page<TimesheetDTO> getPendingTimesheets(Pageable pageable) {
        return timesheetRepo.findByStatusOrderBySubmittedAtAsc(TimesheetStatus.SUBMITTED, pageable).map(this::toDTO);
    }

    // ── Private helpers ────────────────────────────────────────────────────────
    private Employee getActive(String empId) {
        Employee e = employeeRepo.findByEmpIdAndIsEmployeeActiveTrue(empId);
        if (e == null) throw new EmployeeNotFoundException("Employee not found: " + empId);
        return e;
    }
    private LocalDate toMonday(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }
    private Set<LocalDate> getWeekNonWorkingDates(LocalDate monday) {
        return holidayRepo.findByHolidayDateBetweenOrderByHolidayDateAsc(monday, monday.plusDays(4))
                .stream().map(h -> h.getHolidayDate()).collect(Collectors.toSet());
    }
    private BigDecimal validateHours(BigDecimal hours, LocalDate date, Set<LocalDate> publicHolidays) {
        if (publicHolidays.contains(date)) return BigDecimal.ZERO;
        return orZero(hours);
    }
    private BigDecimal orZero(BigDecimal v) { return v != null ? v : BigDecimal.ZERO; }

    private TimesheetDTO toDTO(Timesheet t) {
        return TimesheetDTO.builder()
                .id(t.getId()).empId(t.getEmployee().getEmpId())
                .employeeName(t.getEmployee().getName()).department(t.getEmployee().getDepartment())
                .weekStartDate(t.getWeekStartDate()).project(t.getProject())
                .taskDescription(t.getTaskDescription())
                .mondayHours(t.getMondayHours()).tuesdayHours(t.getTuesdayHours())
                .wednesdayHours(t.getWednesdayHours()).thursdayHours(t.getThursdayHours())
                .fridayHours(t.getFridayHours()).saturdayHours(t.getSaturdayHours())
                .sundayHours(t.getSundayHours()).totalHours(t.getTotalHours())
                .status(t.getStatus()).submittedAt(t.getSubmittedAt())
                .approvedBy(t.getApprovedBy()).approvedAt(t.getApprovedAt())
                .reviewNotes(t.getReviewNotes()).createdAt(t.getCreatedAt()).build();
    }
}