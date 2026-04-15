package com.employee.config;
import lombok.*;
@Data @AllArgsConstructor @Builder
public class LoginResponse {
    private String token;
    private String refreshToken;
}
