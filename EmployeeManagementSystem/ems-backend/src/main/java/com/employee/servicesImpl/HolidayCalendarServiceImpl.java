package com.employee.servicesImpl;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.employee.dto.HolidayCalendarDTO;
import com.employee.entity.HolidayCalendar;
import com.employee.repository.HolidayCalendarRepository;
import com.employee.services.HolidayCalendarService;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class HolidayCalendarServiceImpl implements HolidayCalendarService {

    private final HolidayCalendarRepository repo;

    @Override
    @Transactional
    public HolidayCalendarDTO addHoliday(HolidayCalendarDTO dto, String addedBy) {
        if (repo.existsByHolidayDate(dto.getHolidayDate()))
            throw new IllegalStateException("A holiday already exists on " + dto.getHolidayDate());

        HolidayCalendar h = HolidayCalendar.builder()
                .holidayDate(dto.getHolidayDate())
                .name(dto.getName())
                .description(dto.getDescription())
                .isMandatory(dto.getIsMandatory() != null ? dto.getIsMandatory() : true)
                .createdBy(addedBy)
                .build();
        return toDTO(repo.save(h));
    }

    @Override
    @Transactional
    public HolidayCalendarDTO updateHoliday(Long id, HolidayCalendarDTO dto, String updatedBy) {
        HolidayCalendar h = repo.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Holiday not found: " + id));
        if (dto.getName()        != null) h.setName(dto.getName());
        if (dto.getDescription() != null) h.setDescription(dto.getDescription());
        if (dto.getIsMandatory() != null) h.setIsMandatory(dto.getIsMandatory());
        return toDTO(repo.save(h));
    }

    @Override
    @Transactional
    public void deleteHoliday(Long id) {
        if (!repo.existsById(id))
            throw new EntityNotFoundException("Holiday not found: " + id);
        repo.deleteById(id);
    }

    @Override
    public List<HolidayCalendarDTO> getHolidaysByYear(int year) {
        return repo.findByYear(year).stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Override
    public boolean isHolidayOrWeekend(LocalDate date) {
        DayOfWeek dow = date.getDayOfWeek();
        if (dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY) return true;
        return repo.existsByHolidayDate(date);
    }

    @Override
    public List<LocalDate> getNonWorkingDates(LocalDate start, LocalDate end) {
        Set<LocalDate> publicHolidays = repo
                .findByHolidayDateBetweenOrderByHolidayDateAsc(start, end)
                .stream()
                .map(HolidayCalendar::getHolidayDate)
                .collect(Collectors.toSet());

        List<LocalDate> nonWorking = new ArrayList<>();
        LocalDate cur = start;
        while (!cur.isAfter(end)) {
            DayOfWeek dow = cur.getDayOfWeek();
            if (dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY
                    || publicHolidays.contains(cur)) {
                nonWorking.add(cur);
            }
            cur = cur.plusDays(1);
        }
        return nonWorking;
    }

    private HolidayCalendarDTO toDTO(HolidayCalendar h) {
        return HolidayCalendarDTO.builder()
                .id(h.getId())
                .holidayDate(h.getHolidayDate())
                .name(h.getName())
                .description(h.getDescription())
                .isMandatory(h.getIsMandatory())
                .createdBy(h.getCreatedBy())
                .createdAt(h.getCreatedAt())
                .build();
    }
}
