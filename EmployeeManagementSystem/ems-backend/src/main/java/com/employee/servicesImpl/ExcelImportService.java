package com.employee.servicesImpl;

import java.io.InputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.employee.dto.EmployeeDTO;
import com.employee.dto.ImportResultDTO;
import com.employee.dto.ImportResultDTO.ImportErrorDTO;
import com.employee.enums.RolesEnum;
import com.employee.services.EmployeeService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExcelImportService {

    private final EmployeeService employeeService;

    // Expected column headers (case-insensitive match)
    private static final List<String> REQUIRED_COLS = List.of(
            "name", "company email", "personal email",
            "phone number", "address", "department",
            "designation", "date of joining", "date of birth"
    );

    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy"),
            DateTimeFormatter.ofPattern("d/M/yyyy"),
            DateTimeFormatter.ofPattern("d-M-yyyy")
    );

    // ── Main import method ────────────────────────────────────────────────────
    public ImportResultDTO importEmployees(MultipartFile file) {
        List<ImportErrorDTO> errors        = new ArrayList<>();
        List<EmployeeDTO>    created       = new ArrayList<>();
        int rowNumber = 1; // 1-based, header is row 1

        try (InputStream is = file.getInputStream();
             Workbook workbook = WorkbookFactory.create(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null || sheet.getPhysicalNumberOfRows() < 2) {
                errors.add(ImportErrorDTO.builder()
                        .rowNumber(1).message("File is empty or has no data rows.").build());
                return buildResult(created, errors);
            }

            // ── Parse header row ──────────────────────────────────────────────
            Row headerRow = sheet.getRow(0);
            if (headerRow == null) {
                errors.add(ImportErrorDTO.builder()
                        .rowNumber(1).message("Header row is missing.").build());
                return buildResult(created, errors);
            }

            Map<String, Integer> colIndex = buildColumnIndex(headerRow);

            // Validate required columns exist
            List<String> missing = new ArrayList<>();
            for (String req : REQUIRED_COLS) {
                if (!colIndex.containsKey(req)) missing.add(req);
            }
            if (!missing.isEmpty()) {
                errors.add(ImportErrorDTO.builder().rowNumber(1)
                        .message("Missing required columns: " + String.join(", ", missing)).build());
                return buildResult(created, errors);
            }

            // ── Process each data row ─────────────────────────────────────────
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                rowNumber = i + 1; // human-readable row number
                Row row = sheet.getRow(i);
                if (row == null || isRowEmpty(row)) continue;

                try {
                    EmployeeDTO dto = parseRow(row, colIndex, rowNumber);
                    EmployeeDTO result = employeeService.createEmployee(dto);
                    created.add(result);
                } catch (Exception ex) {
                    errors.add(ImportErrorDTO.builder()
                            .rowNumber(rowNumber)
                            .message(ex.getMessage())
                            .build());
                    log.warn("Row {} failed: {}", rowNumber, ex.getMessage());
                }
            }

        } catch (Exception ex) {
            errors.add(ImportErrorDTO.builder()
                    .rowNumber(rowNumber)
                    .message("Failed to read Excel file: " + ex.getMessage())
                    .build());
        }

        return buildResult(created, errors);
    }

    // ── Parse a single data row into EmployeeDTO ──────────────────────────────
    private EmployeeDTO parseRow(Row row, Map<String, Integer> idx, int rowNum) {
        String name          = requireString(row, idx, "name",          rowNum);
        String companyEmail  = requireString(row, idx, "company email",  rowNum);
        String personalEmail = requireString(row, idx, "personal email", rowNum);
        String phone         = requireString(row, idx, "phone number",   rowNum);
        String address       = requireString(row, idx, "address",        rowNum);
        String department    = requireString(row, idx, "department",     rowNum);
        String designation   = requireString(row, idx, "designation",    rowNum);
        LocalDate dateOfJoin = requireDate(row, idx, "date of joining", rowNum);
        LocalDate dateOfBirth= requireDate(row, idx, "date of birth",   rowNum);

        // Optional fields
        String skills      = optString(row, idx, "skills");
        String description = optString(row, idx, "description");
        String rolesRaw    = optString(row, idx, "roles");

        // Validate email format
        if (!companyEmail.contains("@"))
            throw new IllegalArgumentException("Row " + rowNum + ": Invalid company email format.");
        if (!personalEmail.contains("@"))
            throw new IllegalArgumentException("Row " + rowNum + ": Invalid personal email format.");

        // Parse roles — default to EMPLOYEE
        Set<RolesEnum> roles = new HashSet<>();
        if (rolesRaw != null && !rolesRaw.isBlank()) {
            for (String r : rolesRaw.split(",")) {
                try { roles.add(RolesEnum.valueOf(r.trim().toUpperCase())); }
                catch (IllegalArgumentException e) {
                    throw new IllegalArgumentException(
                            "Row " + rowNum + ": Unknown role '" + r.trim() + "'.");
                }
            }
        }
        if (roles.isEmpty()) roles.add(RolesEnum.EMPLOYEE);

        return EmployeeDTO.builder()
                .name(name)
                .companyEmail(companyEmail)
                .personalEmail(personalEmail)
                .phoneNumber(phone)
                .address(address)
                .department(department)
                .designation(designation)
                .skills(skills)
                .description(description)
                .dateOfJoin(dateOfJoin)
                .dateOfBirth(dateOfBirth)
                .roles(roles)
                .build();
    }

    // ── Column index builder ──────────────────────────────────────────────────
    private Map<String, Integer> buildColumnIndex(Row headerRow) {
        Map<String, Integer> map = new HashMap<>();
        for (Cell cell : headerRow) {
            if (cell != null && cell.getCellType() == CellType.STRING) {
                map.put(cell.getStringCellValue().trim().toLowerCase(), cell.getColumnIndex());
            }
        }
        return map;
    }

    // ── Cell helpers ──────────────────────────────────────────────────────────
    private String requireString(Row row, Map<String, Integer> idx, String col, int rowNum) {
        String val = optString(row, idx, col);
        if (val == null || val.isBlank())
            throw new IllegalArgumentException("Row " + rowNum + ": '" + col + "' is required.");
        return val.trim();
    }

    private String optString(Row row, Map<String, Integer> idx, String col) {
        Integer colIdx = idx.get(col);
        if (colIdx == null) return null;
        Cell cell = row.getCell(colIdx);
        if (cell == null) return null;
        return switch (cell.getCellType()) {
            case STRING  -> cell.getStringCellValue();
            case NUMERIC -> String.valueOf((long) cell.getNumericCellValue());
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            default      -> null;
        };
    }

    private LocalDate requireDate(Row row, Map<String, Integer> idx, String col, int rowNum) {
        Integer colIdx = idx.get(col);
        if (colIdx == null)
            throw new IllegalArgumentException("Row " + rowNum + ": Column '" + col + "' not found.");

        Cell cell = row.getCell(colIdx);
        if (cell == null)
            throw new IllegalArgumentException("Row " + rowNum + ": '" + col + "' is required.");

        // Excel date cell
        if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            return cell.getLocalDateTimeCellValue().toLocalDate();
        }

        // String date — try multiple formats
        String raw = optString(row, idx, col);
        if (raw == null || raw.isBlank())
            throw new IllegalArgumentException("Row " + rowNum + ": '" + col + "' is required.");

        for (DateTimeFormatter fmt : DATE_FORMATS) {
            try { return LocalDate.parse(raw.trim(), fmt); }
            catch (DateTimeParseException ignored) {}
        }
        throw new IllegalArgumentException(
                "Row " + rowNum + ": Cannot parse date '" + raw +
                "' for column '" + col + "'. Use YYYY-MM-DD or DD/MM/YYYY.");
    }

    private boolean isRowEmpty(Row row) {
        for (Cell cell : row) {
            if (cell != null && cell.getCellType() != CellType.BLANK) return false;
        }
        return true;
    }

    private ImportResultDTO buildResult(List<EmployeeDTO> created, List<ImportErrorDTO> errors) {
        return ImportResultDTO.builder()
                .successCount(created.size())
                .failureCount(errors.size())
                .createdEmployees(created)
                .errors(errors)
                .build();
    }
}
