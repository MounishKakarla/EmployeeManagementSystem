package com.employee.config;
import lombok.*;
@Data @NoArgsConstructor @AllArgsConstructor
public class RefreshTokenRequest {
    private String refreshToken;
}
