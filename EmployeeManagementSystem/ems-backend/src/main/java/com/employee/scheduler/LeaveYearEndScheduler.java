package com.employee.scheduler;

import java.time.LocalDate;
import java.util.List;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.employee.entity.Employee;
import com.employee.entity.LeaveBalance;
import com.employee.repository.EmployeeRepository;
import com.employee.repository.LeaveBalanceRepository;
import com.employee.services.LeaveCalculationService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Runs at 00:05 AM on January 1st every year.
 *
 * For each active employee:
 *   1. Carry forward unused Annual leave from last year (capped at 30 days;
 *      any surplus above 30 is forfeited — oldest excess shed by the hard cap)
 *   2. Reset Sick leave to 6 days (no carry-forward)
 *   3. Reset Casual leave to 4 days (no carry-forward)
 *   4. Create the new year's LeaveBalance record
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class LeaveYearEndScheduler {

    private final EmployeeRepository      employeeRepo;
    private final LeaveBalanceRepository  balanceRepo;
    private final LeaveCalculationService calcService;

    @Scheduled(cron = "0 5 0 1 1 *")   // 00:05 AM, Jan 1st every year
    @Transactional
    public void performYearEndReset() {

        int newYear  = LocalDate.now().getYear();
        int prevYear = newYear - 1;

        log.info("LeaveYearEndScheduler: Starting year-end reset for {} → {}", prevYear, newYear);

        List<Employee> activeEmployees = employeeRepo.findAllByIsEmployeeActiveTrue();
        int created = 0, skipped = 0;

        for (Employee emp : activeEmployees) {
            try {
                // Skip if new year record already exists (idempotent guard)
                if (balanceRepo.findByEmployeeEmpIdAndYear(emp.getEmpId(), newYear).isPresent()) {
                    skipped++;
                    continue;
                }

                // Fetch previous year's balance; fall back to a zero record if absent
                LeaveBalance prev = balanceRepo
                        .findByEmployeeEmpIdAndYear(emp.getEmpId(), prevYear)
                        .orElse(LeaveBalance.builder()
                                .employee(emp)
                                .year(prevYear)
                                .annualTotal(0).annualUsed(0).annualCarriedForward(0)
                                .sickTotal(0).sickUsed(0)
                                .casualTotal(0).casualUsed(0)
                                .unpaidUsed(0)
                                .build());

                // yearEndReset enforces the 30-day carry-forward cap;
                // any annual balance above 30 is forfeited here.
                LeaveBalance newBalance = calcService.yearEndReset(emp, prev, newYear);

                balanceRepo.save(newBalance);
                created++;

                log.debug("LeaveYearEndScheduler: empId={} → annual={} (cf={}, forfeited={}), sick={}, casual={}",
                        emp.getEmpId(),
                        newBalance.getAnnualTotal(),
                        newBalance.getAnnualCarriedForward(),
                        Math.max(0, prev.getRemainingAnnual() - LeaveCalculationService.ANNUAL_CARRY_CAP),
                        newBalance.getSickTotal(),
                        newBalance.getCasualTotal());

            } catch (Exception e) {
                log.error("LeaveYearEndScheduler: Failed to reset balance for empId={}: {}",
                        emp.getEmpId(), e.getMessage());
            }
        }

        log.info("LeaveYearEndScheduler: Done. Created={}, Skipped={}, Total={}",
                created, skipped, activeEmployees.size());
    }
}
