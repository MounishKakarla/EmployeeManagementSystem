package com.employee.config;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.employee.entity.Attendance;
import com.employee.entity.Employee;
import com.employee.enums.AttendanceStatus;
import com.employee.repository.AttendanceRepository;
import com.employee.repository.EmployeeRepository;
import com.employee.services.HolidayCalendarService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Runs every weekday at 10:00 AM.
 * Automatically creates ABSENT records for any active employee
 * who has not checked in yet today — unless today is a weekend or holiday.
 *
 * Enable scheduling in EmsBackendApplication with @EnableScheduling.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AbsenceScheduler {

    private final AttendanceRepository    attendanceRepo;
    private final EmployeeRepository      employeeRepo;
    private final HolidayCalendarService  holidayService;

    /**
     * Cron: 0 0 10 * * MON-FRI  — 10:00 AM every Monday to Friday.
     * Also does a holiday check so it skips public holidays automatically.
     */
    @Scheduled(cron = "0 0 10 * * MON-FRI")
    @Transactional
    public void markAbsentEmployees() {
        LocalDate today = LocalDate.now();

        // Double-check: skip if today is a public holiday
        if (holidayService.isHolidayOrWeekend(today)) {
            log.info("AbsenceScheduler: {} is a holiday/weekend — skipping.", today);
            return;
        }

        // Find all active employees who have NO attendance record today
        List<String> absentIds = attendanceRepo.findAbsentEmployeeIdsOnDate(today);

        if (absentIds.isEmpty()) {
            log.info("AbsenceScheduler: All employees checked in by 10AM on {}", today);
            return;
        }

        int count = 0;
        for (String empId : absentIds) {
            Employee emp = employeeRepo.findByEmpIdAndIsEmployeeActiveTrue(empId);
            if (emp == null) continue;

            Attendance absent = Attendance.builder()
                    .employee(emp)
                    .attendanceDate(today)
                    .status(AttendanceStatus.ABSENT)
                    .notes("Auto-marked ABSENT by system scheduler at 10:00 AM")
                    .recordedBy("SYSTEM")
                    .build();
            attendanceRepo.save(absent);
            count++;
        }
        log.info("AbsenceScheduler: Marked {} employee(s) ABSENT on {}", count, today);
    }

    /**
     * Cron: 0 1 0 * * MON-SUN  — 00:01 AM every day.
     * Marks all active employees HOLIDAY or WEEKEND for today if applicable.
     * This ensures the calendar view always has a record for non-working days.
     */
    @Scheduled(cron = "0 1 0 * * MON-SUN")
    @Transactional
    public void markHolidaysAndWeekends() {
        LocalDate today = LocalDate.now();
        DayOfWeek dow   = today.getDayOfWeek();

        boolean isWeekend = dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY;
        boolean isHoliday = holidayService.isHolidayOrWeekend(today) && !isWeekend;

        if (!isWeekend && !isHoliday) return;

        AttendanceStatus status = isWeekend ? AttendanceStatus.WEEKEND : AttendanceStatus.HOLIDAY;
        String note = isWeekend ? "Weekend" : "Public Holiday";

        List<String> absentIds = attendanceRepo.findAbsentEmployeeIdsOnDate(today);
        int count = 0;
        for (String empId : absentIds) {
            Employee emp = employeeRepo.findByEmpIdAndIsEmployeeActiveTrue(empId);
            if (emp == null) continue;

            Attendance rec = Attendance.builder()
                    .employee(emp)
                    .attendanceDate(today)
                    .status(status)
                    .notes(note)
                    .recordedBy("SYSTEM")
                    .build();
            attendanceRepo.save(rec);
            count++;
        }
        if (count > 0)
            log.info("AbsenceScheduler: Created {} {} records for {}", count, status, today);
    }
}
