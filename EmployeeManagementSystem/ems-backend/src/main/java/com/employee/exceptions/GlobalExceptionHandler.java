package com.employee.exceptions;
import java.time.LocalDateTime;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authentication.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@ControllerAdvice
public class GlobalExceptionHandler {

    // ── Domain exceptions ──────────────────────────────────────────────────────
    @ExceptionHandler(EmployeeNotFoundException.class)
    public ResponseEntity<ErrorResponse> h1(EmployeeNotFoundException ex)
        { return b(ex.getMessage(), HttpStatus.NOT_FOUND); }

    @ExceptionHandler(InactiveEmployeeException.class)
    public ResponseEntity<ErrorResponse> h2(InactiveEmployeeException ex)
        { return b(ex.getMessage(), HttpStatus.FORBIDDEN); }

    @ExceptionHandler(DuplicateEmployeeException.class)
    public ResponseEntity<ErrorResponse> h3(DuplicateEmployeeException ex)
        { return b(ex.getMessage(), HttpStatus.CONFLICT); }

    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<ErrorResponse> h4(EntityNotFoundException ex)
        { return b(ex.getMessage(), HttpStatus.NOT_FOUND); }

    @ExceptionHandler(InvalidTokenException.class)
    public ResponseEntity<ErrorResponse> h5(InvalidTokenException ex)
        { return b(ex.getMessage(), HttpStatus.UNAUTHORIZED); }

    @ExceptionHandler(EmailSendException.class)
    public ResponseEntity<ErrorResponse> h6(EmailSendException ex)
        { return b(ex.getMessage(), HttpStatus.SERVICE_UNAVAILABLE); }

    // ── Spring Security exceptions ─────────────────────────────────────────────
    @ExceptionHandler(DisabledException.class)
    public ResponseEntity<ErrorResponse> h7(DisabledException ex)
        { return b(ex.getMessage(), HttpStatus.FORBIDDEN); }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ErrorResponse> h8(BadCredentialsException ex)
        { return b(ex.getMessage(), HttpStatus.UNAUTHORIZED); }

    // ── Validation / request shape exceptions ─────────────────────────────────
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> h9(IllegalArgumentException ex)
        { return b(ex.getMessage(), HttpStatus.BAD_REQUEST); }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> h10(IllegalStateException ex)
        { return b(ex.getMessage(), HttpStatus.CONFLICT); }

    /** Malformed JSON body or unrecognised enum value in the request */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> h11(HttpMessageNotReadableException ex) {
        String msg = ex.getMessage();
        if (msg != null && msg.contains("not one of the values accepted for Enum")) {
            return b("Invalid value supplied. Please check the allowed options and try again.",
                     HttpStatus.BAD_REQUEST);
        }
        return b("The request body could not be read. Please check for malformed JSON or missing fields.",
                 HttpStatus.BAD_REQUEST);
    }

    /** Missing @RequestParam */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> h12(MissingServletRequestParameterException ex) {
        return b("Required parameter '" + ex.getParameterName() + "' is missing.",
                 HttpStatus.BAD_REQUEST);
    }

    /** Wrong type for a path variable or request parameter (e.g. letter where an ID is expected) */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> h13(MethodArgumentTypeMismatchException ex) {
        return b("Invalid value '" + ex.getValue() + "' for parameter '" + ex.getName() + "'.",
                 HttpStatus.BAD_REQUEST);
    }

    /** Bean-validation failures (@Valid / @Validated on request bodies) */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> h14(MethodArgumentNotValidException ex) {
        String first = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .findFirst()
                .orElse("Validation failed.");
        return b(first, HttpStatus.BAD_REQUEST);
    }

    // ── Catch-all ──────────────────────────────────────────────────────────────
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ErrorResponse> h99(RuntimeException ex)
        { return b("An unexpected error occurred. Please try again or contact support if the problem persists.",
                   HttpStatus.INTERNAL_SERVER_ERROR); }

    private ResponseEntity<ErrorResponse> b(String m, HttpStatus s) {
        return ResponseEntity.status(s).body(new ErrorResponse(s.value(), m, LocalDateTime.now()));
    }
}
