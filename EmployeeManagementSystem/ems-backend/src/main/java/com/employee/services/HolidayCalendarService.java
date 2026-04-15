package com.employee.services;

import java.time.LocalDate;
import java.util.List;

import com.employee.dto.HolidayCalendarDTO;

public interface HolidayCalendarService {
    HolidayCalendarDTO     addHoliday(HolidayCalendarDTO dto, String addedBy);
    HolidayCalendarDTO     updateHoliday(Long id, HolidayCalendarDTO dto, String updatedBy);
    void                   deleteHoliday(Long id);
    List<HolidayCalendarDTO> getHolidaysByYear(int year);
    boolean                isHolidayOrWeekend(LocalDate date);

    /** Returns all dates that are weekends OR public holidays in the given range */
    List<LocalDate>        getNonWorkingDates(LocalDate start, LocalDate end);
}
