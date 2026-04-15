package com.employee.exceptions;
import java.time.LocalDateTime;
import lombok.*;
@Data @AllArgsConstructor
public class ErrorResponse {
    private int status;
    private String message;
    private LocalDateTime timestamp;
}
