package com.employee.config;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
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
 * Automated attendance housekeeping jobs, all running in IST (Asia/Kolkata).
 *
 * Real-world pattern: schedulers always specify a timezone so the cron fires
 * at the correct local time regardless of where the server is hosted.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AbsenceScheduler {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final AttendanceRepository   attendanceRepo;
    private final EmployeeRepository     employeeRepo;
    private final HolidayCalendarService holidayService;

    /**
     * Runs at 10:00 AM IST, Mon–Fri.
     * Marks ABSENT any active employee who has no attendance record by that time.
     * Records are created with checkInTime = null so a late check-in can still
     * update them (see AttendanceServiceImpl.checkIn).
     */
    @Scheduled(cron = "0 0 10 * * MON-FRI", zone = "Asia/Kolkata")
    @Transactional
    public void markAbsentEmployees() {
        LocalDate today = LocalDate.now(IST);

        if (holidayService.isHolidayOrWeekend(today)) {
            log.info("AbsenceScheduler: {} is a holiday/weekend — skipping absent sweep.", today);
            return;
        }

        List<String> absentIds = attendanceRepo.findAbsentEmployeeIdsOnDate(today);
        if (absentIds.isEmpty()) {
            log.info("AbsenceScheduler: All employees have records by 10:00 AM IST on {}", today);
            return;
        }

        int count = 0;
        for (String empId : absentIds) {
            Employee emp = employeeRepo.findByEmpIdAndIsEmployeeActiveTrue(empId);
            if (emp == null) continue;

            // checkInTime intentionally left null — a late check-in can still update this record
            Attendance absent = Attendance.builder()
                    .employee(emp)
                    .attendanceDate(today)
                    .status(AttendanceStatus.ABSENT)
                    .notes("Auto-marked ABSENT at 10:00 AM IST — no check-in recorded")
                    .recordedBy("SYSTEM")
                    .build();
            attendanceRepo.save(absent);
            count++;
        }
        log.info("AbsenceScheduler: Marked {} employee(s) ABSENT on {}", count, today);
    }

    /**
     * Runs at 00:01 AM IST every day.
     * Creates WEEKEND or HOLIDAY records for all employees on non-working days
     * so that the calendar view always has complete coverage.
     */
    @Scheduled(cron = "0 1 0 * * MON-SUN", zone = "Asia/Kolkata")
    @Transactional
    public void markHolidaysAndWeekends() {
        LocalDate today = LocalDate.now(IST);
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
