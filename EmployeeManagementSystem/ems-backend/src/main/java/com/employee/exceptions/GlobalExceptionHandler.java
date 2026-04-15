package com.employee.exceptions;
import java.time.LocalDateTime;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.*;
import org.springframework.security.authentication.*;
import org.springframework.web.bind.annotation.*;
@ControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(EmployeeNotFoundException.class)
    public ResponseEntity<ErrorResponse> h1(EmployeeNotFoundException ex){return b(ex.getMessage(),HttpStatus.NOT_FOUND);}
    @ExceptionHandler(InactiveEmployeeException.class)
    public ResponseEntity<ErrorResponse> h2(InactiveEmployeeException ex){return b(ex.getMessage(),HttpStatus.FORBIDDEN);}
    @ExceptionHandler(DuplicateEmployeeException.class)
    public ResponseEntity<ErrorResponse> h3(DuplicateEmployeeException ex){return b(ex.getMessage(),HttpStatus.CONFLICT);}
    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<ErrorResponse> h4(EntityNotFoundException ex){return b(ex.getMessage(),HttpStatus.NOT_FOUND);}
    @ExceptionHandler(InvalidTokenException.class)
    public ResponseEntity<ErrorResponse> h5(InvalidTokenException ex){return b(ex.getMessage(),HttpStatus.UNAUTHORIZED);}
    @ExceptionHandler(DisabledException.class)
    public ResponseEntity<ErrorResponse> h6(DisabledException ex){return b(ex.getMessage(),HttpStatus.FORBIDDEN);}
    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ErrorResponse> h7(BadCredentialsException ex){return b(ex.getMessage(),HttpStatus.UNAUTHORIZED);}
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> h8(IllegalArgumentException ex){return b(ex.getMessage(),HttpStatus.BAD_REQUEST);}
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> h9(IllegalStateException ex){return b(ex.getMessage(),HttpStatus.CONFLICT);}
    @ExceptionHandler(EmailSendException.class)
    public ResponseEntity<ErrorResponse> h10(EmailSendException ex){return b(ex.getMessage(),HttpStatus.SERVICE_UNAVAILABLE);}
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ErrorResponse> h11(RuntimeException ex){return b(ex.getMessage(),HttpStatus.INTERNAL_SERVER_ERROR);}
    private ResponseEntity<ErrorResponse> b(String m,HttpStatus s){
        return ResponseEntity.status(s).body(new ErrorResponse(s.value(),m,LocalDateTime.now()));
    }
}
