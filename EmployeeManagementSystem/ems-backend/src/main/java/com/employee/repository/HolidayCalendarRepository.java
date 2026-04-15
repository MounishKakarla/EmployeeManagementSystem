package com.employee.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.employee.entity.HolidayCalendar;

@Repository
public interface HolidayCalendarRepository extends JpaRepository<HolidayCalendar, Long> {

    Optional<HolidayCalendar> findByHolidayDate(LocalDate date);

    boolean existsByHolidayDate(LocalDate date);

    /** All holidays in a given year */
    @Query("SELECT h FROM HolidayCalendar h WHERE YEAR(h.holidayDate) = :year ORDER BY h.holidayDate ASC")
    List<HolidayCalendar> findByYear(@Param("year") int year);

    /** All holidays within a date range (used by timesheet working-day calculator) */
    List<HolidayCalendar> findByHolidayDateBetweenOrderByHolidayDateAsc(
            LocalDate start, LocalDate end);
}
