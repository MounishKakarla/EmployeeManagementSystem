package com.employee.controllers;

import java.time.LocalDate;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.employee.dto.HolidayCalendarDTO;
import com.employee.services.AuditService;
import com.employee.services.HolidayCalendarService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/ems/holidays")
@RequiredArgsConstructor
public class HolidayCalendarController {

    private final HolidayCalendarService holidayService;
    private final AuditService           auditService;

    /** GET /ems/holidays?year=2025  — All users can view the holiday calendar */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','EMPLOYEE')")
    @GetMapping
    public List<HolidayCalendarDTO> getHolidays(
            @RequestParam(defaultValue = "#{T(java.time.LocalDate).now().year}") int year) {
        return holidayService.getHolidaysByYear(year);
    }

    /** POST /ems/holidays  — ADMIN only */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<HolidayCalendarDTO> add(
            Authentication auth, @RequestBody HolidayCalendarDTO dto) {
        HolidayCalendarDTO created = holidayService.addHoliday(dto, auth.getName());
        auditService.log(auth.getName(), "ADD_HOLIDAY", dto.getHolidayDate() + " - " + dto.getName());
        return ResponseEntity.ok(created);
    }

    /** PUT /ems/holidays/{id}  — ADMIN only */
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<HolidayCalendarDTO> update(
            Authentication auth, @PathVariable Long id,
            @RequestBody HolidayCalendarDTO dto) {
        HolidayCalendarDTO updated = holidayService.updateHoliday(id, dto, auth.getName());
        auditService.log(auth.getName(), "UPDATE_HOLIDAY", id + " - " + updated.getName());
        return ResponseEntity.ok(updated);
    }

    /** DELETE /ems/holidays/{id}  — ADMIN only */
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<String> delete(Authentication auth, @PathVariable Long id) {
        holidayService.deleteHoliday(id);
        auditService.log(auth.getName(), "DELETE_HOLIDAY", "id=" + id);
        return ResponseEntity.ok("Holiday deleted");
    }

    /** DELETE /ems/holidays/year/{year}  — ADMIN only, bulk-removes all holidays for a year */
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/year/{year}")
    public ResponseEntity<String> deleteAllByYear(Authentication auth, @PathVariable int year) {
        int count = holidayService.deleteAllByYear(year);
        auditService.log(auth.getName(), "CLEAR_HOLIDAYS_YEAR", "Cleared " + count + " holiday(s) for " + year);
        return ResponseEntity.ok("Removed " + count + " holiday(s) for " + year);
    }

    /** GET /ems/holidays/non-working?start=2025-01-01&end=2025-01-31
     *  Returns all weekend + public holiday dates in range (used by timesheet & leave) */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','EMPLOYEE')")
    @GetMapping("/non-working")
    public List<LocalDate> getNonWorkingDates(
            @RequestParam String start,
            @RequestParam String end) {
        return holidayService.getNonWorkingDates(
                LocalDate.parse(start), LocalDate.parse(end));
    }
}
