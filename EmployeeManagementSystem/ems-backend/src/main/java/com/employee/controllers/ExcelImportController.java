package com.employee.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.employee.dto.ImportResultDTO;
import com.employee.servicesImpl.ExcelImportService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/ems/employees")
@RequiredArgsConstructor
public class ExcelImportController {

    private final ExcelImportService excelImportService;

    /**
     * POST /ems/employees/import
     * Upload an Excel (.xlsx) file to bulk-create employees.
     * Only ADMIN role allowed.
     * Accepts multipart/form-data with a file field named "file".
     */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/import")
    public ResponseEntity<ImportResultDTO> importEmployees(
            @RequestParam("file") MultipartFile file) {

        if (file.isEmpty())
            return ResponseEntity.badRequest()
                    .body(ImportResultDTO.builder()
                            .successCount(0).failureCount(1)
                            .errors(java.util.List.of(
                                    ImportResultDTO.ImportErrorDTO.builder()
                                            .rowNumber(0)
                                            .message("Uploaded file is empty.")
                                            .build()))
                            .build());

        String filename = file.getOriginalFilename();
        if (filename == null ||
                (!filename.endsWith(".xlsx") && !filename.endsWith(".xls"))) {
            return ResponseEntity.badRequest()
                    .body(ImportResultDTO.builder()
                            .successCount(0).failureCount(1)
                            .errors(java.util.List.of(
                                    ImportResultDTO.ImportErrorDTO.builder()
                                            .rowNumber(0)
                                            .message("Only .xlsx and .xls files are accepted.")
                                            .build()))
                            .build());
        }

        return ResponseEntity.ok(excelImportService.importEmployees(file));
    }
}
