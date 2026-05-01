package com.employee.services;

import java.time.LocalDate;
import java.time.Month;
import java.time.ZoneId;

import org.springframework.stereotype.Service;

import com.employee.entity.Employee;
import com.employee.entity.LeaveBalance;

/**
 * LEAVE POLICY (as specified):
 * ─────────────────────────────────────────────────────────────────────────────
 * ANNUAL / EARNED LEAVE Full year entitlement : 15 days Accrual : 1.25 days per
 * completed month of service Joining year : Pro-rated from the joining month
 * e.g. joined 15 Apr → gets Apr + May … Dec = 9 months = 9 × 1.25 = 11.25 →
 * floored to 11 days accrued Carry-forward : YES — unused annual leave rolls
 * into next year Maximum carry-forward cap = 30 days (two full years) Any
 * unused annual beyond 30 days is forfeited.
 *
 * SICK LEAVE Full year entitlement : 6 days Accrual : Fixed (NOT monthly) —
 * granted in full at start of year Joining year : Pro-rated by months remaining
 * (ceiling) e.g. joined Apr → 9 months left → ceil(9/12 * 6) = 5 days
 * Carry-forward : NO — resets to 6 every Jan 1 regardless of unused balance
 *
 * CASUAL LEAVE Full year entitlement : 4 days Accrual : Fixed (NOT monthly)
 * Joining year : Pro-rated by months remaining (ceiling) e.g. joined Apr → 9
 * months left → ceil(9/12 * 4) = 3 days Carry-forward : NO — resets to 4 every
 * Jan 1
 * ─────────────────────────────────────────────────────────────────────────────
 */
@Service
public class LeaveCalculationService {

	private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

	// ── Policy constants ───────────────────────────────────────────────────────
	public static final int ANNUAL_FULL_YEAR = 15;
	public static final double ANNUAL_PER_MONTH = 1.25; // 15 / 12
	public static final int ANNUAL_CARRY_CAP = 30; // max days that roll over (2 years)

	public static final int SICK_FULL_YEAR        = 6;
	public static final int CASUAL_FULL_YEAR      = 4;
	public static final int SICK_CASUAL_FULL_YEAR = 10;

	// Maternity Benefit Act, 1961 → 182 calendar days (26 weeks)
	public static final int MATERNITY_DAYS   = 182;
	// Common corporate paternity policy → 15 calendar days
	public static final int PATERNITY_DAYS   = 15;
	// Comp-off: accrued by working holidays; initialised to 0 (granted separately per event)

	/**
	 * Build (or refresh) a LeaveBalance record for a given employee and year.
	 */
	public LeaveBalance compute(Employee employee, int year, LeaveBalance existing, LeaveBalance prevYear) {

		LocalDate joiningDate = employee.getDateOfJoin();
		LocalDate today = LocalDate.now(IST);

		int monthsWorkedThisYear = computeMonthsWorkedInYear(joiningDate, year, today);

		if (monthsWorkedThisYear == 0) {
			return buildZeroBalance(employee, year, existing);
		}

// Is this the year the employee actually joined?
		boolean isJoiningYear = (joiningDate.getYear() == year);

// ── Annual / Earned leave ──────────────────────────────────────────────
// Joining year : accrues monthly (1.25/month) — they didn't work full year
// All other years : full 15 days granted on Jan 1
		int annualAccruedThisYear = isJoiningYear ? (int) Math.floor(monthsWorkedThisYear * ANNUAL_PER_MONTH) // e.g.
																												// Dec
																												// only
																												// → 1
																												// day
				: ANNUAL_FULL_YEAR; // full 15 from Jan 1

		int carryForward = 0;
		if (prevYear != null) {
			carryForward = Math.min(prevYear.getRemainingAnnual(), ANNUAL_CARRY_CAP);
		} else if (existing != null) {
			carryForward = nullSafe(existing.getAnnualCarriedForward());
		}

		int annualTotal = annualAccruedThisYear + carryForward;

// ── Sick leave ─────────────────────────────────────────────────────────
// Joining year : pro-rated by months remaining (ceiling)
// All other years : full 6 days granted on Jan 1
		int sickTotal = isJoiningYear ? proRate(SICK_FULL_YEAR, monthsWorkedThisYear) : SICK_FULL_YEAR;

// ── Casual leave ───────────────────────────────────────────────────────
		int casualTotal = isJoiningYear ? proRate(CASUAL_FULL_YEAR, monthsWorkedThisYear) : CASUAL_FULL_YEAR;

// ── Sick / Casual combined ────────────────────────────────────────────
		int sickCasualTotal = isJoiningYear ? proRate(SICK_CASUAL_FULL_YEAR, monthsWorkedThisYear) : SICK_CASUAL_FULL_YEAR;

		if (existing != null) {
			existing.setAnnualTotal(annualTotal);
			existing.setAnnualCarriedForward(carryForward);
			existing.setSickTotal(sickTotal);
			existing.setCasualTotal(casualTotal);
			if (nullSafe(existing.getSickCasualTotal()) == 0) existing.setSickCasualTotal(sickCasualTotal);
			// Maternity and Paternity are gender-gated:
			//   FEMALE (or OTHER/unknown) → maternity only
			//   MALE                      → paternity only
			String gender = employee.getGender() != null ? employee.getGender().toUpperCase() : "";
			if (!"MALE".equals(gender)) {
				if (existing.getMaternityTotal() == null || existing.getMaternityTotal() == 0)
					existing.setMaternityTotal(MATERNITY_DAYS);
				existing.setPaternityTotal(0);
			} else {
				if (existing.getPaternityTotal() == null || existing.getPaternityTotal() == 0)
					existing.setPaternityTotal(PATERNITY_DAYS);
				existing.setMaternityTotal(0);
			}
			return existing;
		}

		String gender = employee.getGender() != null ? employee.getGender().toUpperCase() : "";
		boolean isMale = "MALE".equals(gender);

		return LeaveBalance.builder()
				.employee(employee).year(year)
				.annualTotal(annualTotal).annualUsed(0)
				.annualCarriedForward(carryForward)
				.sickTotal(sickTotal).sickUsed(0)
				.casualTotal(casualTotal).casualUsed(0)
				.sickCasualTotal(sickCasualTotal).sickCasualUsed(0)
				.maternityTotal(isMale ? 0 : MATERNITY_DAYS).maternityUsed(0)
				.paternityTotal(isMale ? PATERNITY_DAYS : 0).paternityUsed(0)
				.compOffEarned(0).compOffUsed(0)
				.unpaidUsed(0)
				.build();
	}

	/**
	 * Year-end reset — called by scheduler on Jan 1 of newYear.
	 *
	 * Sick and casual do NOT carry forward (reset to full entitlement).
	 * Annual remaining carries forward (capped at {@link #ANNUAL_CARRY_CAP}).
	 *
	 * @param prevBalance may be null for brand-new employees with no previous record
	 */
	public LeaveBalance yearEndReset(Employee employee, LeaveBalance prevBalance, int newYear) {
		int carryForward = (prevBalance != null)
				? Math.min(prevBalance.getRemainingAnnual(), ANNUAL_CARRY_CAP)
				: 0;

		String gender = employee.getGender() != null ? employee.getGender().toUpperCase() : "";
		boolean isMale = "MALE".equals(gender);

		return LeaveBalance.builder()
				.employee(employee)
				.year(newYear)
				.annualTotal(ANNUAL_FULL_YEAR + carryForward)
				.annualUsed(0)
				.annualCarriedForward(carryForward)
				.sickTotal(SICK_FULL_YEAR)
				.sickUsed(0)
				.casualTotal(CASUAL_FULL_YEAR)
				.casualUsed(0)
				.sickCasualTotal(SICK_CASUAL_FULL_YEAR)
				.sickCasualUsed(0)
				.maternityTotal(isMale ? 0 : MATERNITY_DAYS)
				.maternityUsed(0)
				.paternityTotal(isMale ? PATERNITY_DAYS : 0)
				.paternityUsed(0)
				.compOffEarned(0).compOffUsed(0)
				.unpaidUsed(0)
				.build();
	}

	// ── Helpers ────────────────────────────────────────────────────────────────

	public int computeMonthsWorkedInYear(LocalDate joiningDate, int year, LocalDate asOf) {
		LocalDate yearStart = LocalDate.of(year, Month.JANUARY, 1);
		LocalDate yearEnd = LocalDate.of(year, Month.DECEMBER, 31);

		if (joiningDate.isAfter(yearEnd))
			return 0;

		LocalDate from = joiningDate.isAfter(yearStart) ? joiningDate : yearStart;
		LocalDate to = asOf.isBefore(yearEnd) ? asOf : yearEnd;

		if (from.isAfter(to))
			return 0;

		return to.getMonthValue() - from.getMonthValue() + 1;
	}

	private int proRate(int fullYearDays, int monthsWorked) {
		if (monthsWorked >= 12)
			return fullYearDays;
		return (int) Math.ceil(monthsWorked / 12.0 * fullYearDays);
	}

	/**
	 * Null-safe unbox — treats NULL DB columns as 0. Needed for legacy rows that
	 * were persisted before defaults were enforced.
	 */
	private int nullSafe(Integer value) {
		return value != null ? value : 0;
	}

	private LeaveBalance buildZeroBalance(Employee employee, int year, LeaveBalance existing) {
		if (existing != null)
			return existing;
		return LeaveBalance.builder().employee(employee).year(year).annualTotal(0).annualUsed(0).annualCarriedForward(0)
				.sickTotal(0).sickUsed(0).casualTotal(0).casualUsed(0)
				.sickCasualTotal(0).sickCasualUsed(0).unpaidUsed(0).build();
	}
}