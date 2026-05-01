package com.employee.servicesImpl;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.employee.dto.AttendanceDTO;
import com.employee.dto.AttendanceSummaryDTO;
import com.employee.entity.Attendance;
import com.employee.entity.Employee;
import com.employee.enums.AttendanceStatus;
import com.employee.exceptions.EmployeeNotFoundException;
import com.employee.repository.AttendanceRepository;
import com.employee.repository.EmployeeRepository;
import com.employee.services.AttendanceService;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AttendanceServiceImpl implements AttendanceService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final AttendanceRepository attendanceRepository;
    private final EmployeeRepository employeeRepository;

    // ── Check In ───────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public AttendanceDTO checkIn(String empId, String notes) {
        Employee employee = getActiveEmployee(empId);
        LocalDate today   = LocalDate.now(IST);
        LocalTime now     = LocalTime.now(IST);

        java.util.Optional<Attendance> existing =
                attendanceRepository.findByEmployeeEmpIdAndAttendanceDate(empId, today);

        if (existing.isPresent()) {
            Attendance record = existing.get();
            if (record.getCheckInTime() != null) {
                // Genuinely already checked in
                throw new IllegalStateException(
                        "You have already checked in today. Use check-out or contact your manager.");
            }
            // Auto-created record (ABSENT/WEEKEND/HOLIDAY from scheduler) — allow late check-in
            record.setCheckInTime(now);
            record.setStatus(now.isAfter(LocalTime.of(9, 30))
                    ? AttendanceStatus.LATE : AttendanceStatus.PRESENT);
            record.setRecordedBy(empId);
            if (notes != null && !notes.isBlank()) record.setNotes(notes);
            return toDTO(attendanceRepository.save(record));
        }

        // No record yet — create fresh check-in
        AttendanceStatus status = now.isAfter(LocalTime.of(9, 30))
                ? AttendanceStatus.LATE
                : AttendanceStatus.PRESENT;

        Attendance record = Attendance.builder()
                .employee(employee)
                .attendanceDate(today)
                .checkInTime(now)
                .status(status)
                .notes(notes)
                .recordedBy(empId)
                .build();

        return toDTO(attendanceRepository.save(record));
    }

    // ── Check Out ──────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public AttendanceDTO checkOut(String empId) {
        LocalDate today = LocalDate.now(IST);

        Attendance record = attendanceRepository
                .findByEmployeeEmpIdAndAttendanceDate(empId, today)
                .orElseThrow(() -> new IllegalStateException(
                        "No check-in record found for today. Please check in first."));

        if (record.getCheckInTime() == null) {
            throw new IllegalStateException("You have not checked in today yet.");
        }
        if (record.getCheckOutTime() != null) {
            throw new IllegalStateException(
                "You have already checked out today at " + record.getCheckOutTime().toString().substring(0, 5) +
                ". Contact your manager if you need to update your check-out time.");
        }

        record.setCheckOutTime(LocalTime.now(IST));
        // If half a day (< 4 hours), downgrade status — handle overnight (checkout < checkin)
        if (record.getCheckInTime() != null) {
            long minutes = java.time.Duration.between(
                    record.getCheckInTime(), record.getCheckOutTime()).toMinutes();
            if (minutes <= 0) minutes += 24 * 60; // overnight shift
            if (minutes < 240 && record.getStatus() == AttendanceStatus.PRESENT) {
                record.setStatus(AttendanceStatus.HALF_DAY);
            }
        }

        return toDTO(attendanceRepository.save(record));
    }

    // ── Own history ────────────────────────────────────────────────────────────

    @Override
    public Page<AttendanceDTO> getMyAttendance(String empId, Pageable pageable) {
        return attendanceRepository
                .findByEmployeeEmpIdOrderByAttendanceDateDesc(empId, pageable)
                .map(this::toDTO);
    }

    @Override
    public List<AttendanceDTO> getMyAttendanceRange(
            String empId, LocalDate start, LocalDate end) {
        return attendanceRepository
                .findByEmployeeEmpIdAndAttendanceDateBetweenOrderByAttendanceDateAsc(
                        empId, start, end)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    // ── Today's status ─────────────────────────────────────────────────────────

    @Override
    public AttendanceDTO getTodayStatus(String empId) {
        return attendanceRepository
                .findByEmployeeEmpIdAndAttendanceDate(empId, LocalDate.now(IST))
                .map(this::toDTO)
                .orElse(null);
    }

    // ── Monthly summary ────────────────────────────────────────────────────────

    @Override
    public AttendanceSummaryDTO getMySummary(String empId, int month, int year) {
        return buildSummary(empId, month, year);
    }

    @Override
    public AttendanceSummaryDTO getSummary(String empId, int month, int year) {
        return buildSummary(empId, month, year);
    }

    private AttendanceSummaryDTO buildSummary(String empId, int month, int year) {
        Employee employee = getActiveEmployee(empId);

        long present       = countByStatus(empId, month, year, AttendanceStatus.PRESENT);
        long absent        = countByStatus(empId, month, year, AttendanceStatus.ABSENT);
        long halfDay       = countByStatus(empId, month, year, AttendanceStatus.HALF_DAY);
        long late          = countByStatus(empId, month, year, AttendanceStatus.LATE);
        long onLeave       = countByStatus(empId, month, year, AttendanceStatus.ON_LEAVE);
        long wfh           = countByStatus(empId, month, year, AttendanceStatus.WORK_FROM_HOME);
        long holiday       = countByStatus(empId, month, year, AttendanceStatus.HOLIDAY);
        long weekend       = countByStatus(empId, month, year, AttendanceStatus.WEEKEND);
        Double totalHours  = attendanceRepository.sumHoursByEmpIdAndMonthAndYear(empId, month, year);

        // Total working days = present + late + half-day + WFH
        long workingDays   = present + late + halfDay + wfh;
        // Attendance %  = working days / (working days + absent) * 100
        double pct = (workingDays + absent) > 0
                ? Math.round((workingDays * 100.0) / (workingDays + absent) * 100.0) / 100.0
                : 0.0;
        double avgHours = workingDays > 0
                ? Math.round((totalHours / workingDays) * 100.0) / 100.0
                : 0.0;

        return AttendanceSummaryDTO.builder()
                .empId(empId)
                .employeeName(employee.getName())
                .month(month)
                .year(year)
                .totalWorkingDays((int) workingDays)
                .presentDays((int) present)
                .absentDays((int) absent)
                .halfDays((int) halfDay)
                .lateDays((int) late)
                .onLeaveDays((int) onLeave)
                .workFromHomeDays((int) wfh)
                .holidayDays((int) holiday)
                .weekendDays((int) weekend)
                .totalHoursWorked(totalHours)
                .averageHoursPerDay(avgHours)
                .attendancePercentage(pct)
                .build();
    }

    // ── Admin / Manager operations ─────────────────────────────────────────────

    @Override
    @Transactional
    public AttendanceDTO createOrOverride(AttendanceDTO dto, String recordedBy) {
        Employee employee = getActiveEmployee(dto.getEmpId());

        // Upsert: update if exists, create if not
        Attendance record = attendanceRepository
                .findByEmployeeEmpIdAndAttendanceDate(dto.getEmpId(), dto.getAttendanceDate())
                .orElse(Attendance.builder()
                        .employee(employee)
                        .attendanceDate(dto.getAttendanceDate())
                        .build());

        record.setCheckInTime(dto.getCheckInTime());
        record.setCheckOutTime(dto.getCheckOutTime());
        record.setStatus(dto.getStatus() != null ? dto.getStatus() : AttendanceStatus.PRESENT);
        record.setNotes(dto.getNotes());
        record.setRecordedBy(recordedBy);

        return toDTO(attendanceRepository.save(record));
    }

    @Override
    @Transactional
    public AttendanceDTO update(Long id, AttendanceDTO dto, String updatedBy) {
        Attendance record = attendanceRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException(
                        "Attendance record not found with id: " + id));

        if (dto.getCheckInTime()  != null) record.setCheckInTime(dto.getCheckInTime());
        if (dto.getCheckOutTime() != null) record.setCheckOutTime(dto.getCheckOutTime());
        if (dto.getStatus()       != null) record.setStatus(dto.getStatus());
        if (dto.getNotes()        != null) record.setNotes(dto.getNotes());
        record.setRecordedBy(updatedBy);

        return toDTO(attendanceRepository.save(record));
    }

    @Override
    @Transactional
    public void delete(Long id) {
        if (!attendanceRepository.existsById(id)) {
            throw new EntityNotFoundException("Attendance record not found with id: " + id);
        }
        attendanceRepository.deleteById(id);
    }

    @Override
    public Page<AttendanceDTO> getTeamAttendance(
            LocalDate start, LocalDate end, String empId, Pageable pageable) {
        return attendanceRepository
                .findTeamAttendance(start, end, empId, pageable)
                .map(this::toDTO);
    }

    @Override
    public List<AttendanceDTO> getDailyAttendance(LocalDate date, String department) {
        if (department != null && !department.isBlank()) {
            return attendanceRepository.findByDateAndDepartment(date, department)
                    .stream().map(this::toDTO).collect(Collectors.toList());
        }
        return attendanceRepository.findAllByDateWithEmployee(date)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private Employee getActiveEmployee(String empId) {
        Employee e = employeeRepository.findByEmpIdAndIsEmployeeActiveTrue(empId);
        if (e == null)
            throw new EmployeeNotFoundException("Employee not found with id: " + empId);
        return e;
    }

    private long countByStatus(String empId, int month, int year, AttendanceStatus status) {
        return attendanceRepository.countByEmpIdAndMonthAndYearAndStatus(
                empId, month, year, status);
    }

    private AttendanceDTO toDTO(Attendance a) {
        return AttendanceDTO.builder()
                .id(a.getId())
                .empId(a.getEmployee().getEmpId())
                .employeeName(a.getEmployee().getName())
                .department(a.getEmployee().getDepartment())
                .profileImage(a.getEmployee().getProfileImage())
                .attendanceDate(a.getAttendanceDate())
                .checkInTime(a.getCheckInTime())
                .checkOutTime(a.getCheckOutTime())
                .totalHours(a.getTotalHours())
                .status(a.getStatus())
                .notes(a.getNotes())
                .recordedBy(a.getRecordedBy())
                .build();
    }
}
