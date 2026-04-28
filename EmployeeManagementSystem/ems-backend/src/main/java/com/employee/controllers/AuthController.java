package com.employee.controllers;

import java.time.Duration;
import java.util.Arrays;
import java.util.Map;

import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import org.springframework.beans.factory.annotation.Value;

import com.employee.config.LoginRequest;
import com.employee.config.RefreshTokenRequest;
import com.employee.dto.ChangePasswordDTO;
import com.employee.services.AuditService;
import com.employee.services.AuthService;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService  authService;
    private final AuditService auditService;

    @Value("${cookie.secure:false}")
    private boolean cookieSecure;

    @Value("${cookie.same-site:Strict}")
    private String cookieSameSite;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        var res = authService.login(request);

        ResponseCookie access = ResponseCookie.from("access_token", res.getToken())
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/")
                .maxAge(Duration.ofHours(1))
                .sameSite(cookieSameSite)
                .build();

        ResponseCookie refresh = ResponseCookie.from("refresh_token", res.getRefreshToken())
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/auth/refresh")
                .maxAge(Duration.ofDays(7))
                .sameSite(cookieSameSite)
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, access.toString())
                .header(HttpHeaders.SET_COOKIE, refresh.toString())
                .body(Map.of(
                    "token", res.getToken(),
                    "refreshToken", res.getRefreshToken(),
                    "message", "Login successful"
                ));
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(HttpServletRequest request, @RequestBody(required = false) RefreshTokenRequest body) {
        String refreshToken = null;
        if (request.getCookies() != null) {
            refreshToken = Arrays.stream(request.getCookies())
                    .filter(c -> "refresh_token".equals(c.getName()))
                    .map(Cookie::getValue)
                    .findFirst()
                    .orElse(null);
        }

        if (refreshToken == null && body != null && body.getRefreshToken() != null) {
            refreshToken = body.getRefreshToken();
        }

        if (refreshToken == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "No refresh token found"));
        }

        var res = authService.refreshToken(new RefreshTokenRequest(refreshToken));

        ResponseCookie newAccess = ResponseCookie.from("access_token", res.getToken())
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/")
                .maxAge(Duration.ofHours(1))
                .sameSite(cookieSameSite)
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, newAccess.toString())
                .body(Map.of(
                    "token", res.getToken(),
                    "message", "Token refreshed"
                ));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        ResponseCookie clearAccess = ResponseCookie.from("access_token", "")
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/")
                .maxAge(0)
                .sameSite(cookieSameSite)
                .build();

        ResponseCookie clearRefresh = ResponseCookie.from("refresh_token", "")
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/auth/refresh")
                .maxAge(0)
                .sameSite(cookieSameSite)
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, clearAccess.toString())
                .header(HttpHeaders.SET_COOKIE, clearRefresh.toString())
                .body(Map.of("message", "Logged out successfully"));
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return ResponseEntity.ok(authService.getCurrentUser(auth.getName()));
    }

    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','EMPLOYEE')")
    @PutMapping("/changePassword")
    public ResponseEntity<String> changePassword(@RequestBody ChangePasswordDTO request) {
        String empId = SecurityContextHolder.getContext().getAuthentication().getName();
        authService.changePassword(empId, request);
        auditService.log(empId, "CHANGE_PASSWORD", "Employee " + empId + " changed password");
        return ResponseEntity.ok("Password Changed Successfully");
    }

    @PreAuthorize("isAuthenticated()")
    @PutMapping("/push-token")
    public ResponseEntity<Void> savePushToken(@RequestBody Map<String, String> body,
                                              Authentication auth) {
        String token = body.get("pushToken");
        if (token != null && !token.isBlank()) {
            authService.savePushToken(auth.getName(), token);
        }
        return ResponseEntity.ok().build();
    }

    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @PostMapping("/reset-password/{empId}")
    public ResponseEntity<String> resetPassword(@PathVariable String empId) {
        String actor = SecurityContextHolder.getContext().getAuthentication().getName();
        authService.resetPassword(empId);
        auditService.log(actor, "RESET_PASSWORD", "Reset password for employee " + empId);
        return ResponseEntity.ok("Password reset. Check mail for the new temporary password.");
    }
}