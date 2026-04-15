package com.employee.servicesImpl;

import java.util.List;
import java.util.Map;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.employee.config.JwtUtils;
import com.employee.config.LoginRequest;
import com.employee.config.LoginResponse;
import com.employee.config.RefreshTokenRequest;
import com.employee.dto.ChangePasswordDTO;
import com.employee.entity.Employee;
import com.employee.entity.User;
import com.employee.exceptions.EmployeeNotFoundException;
import com.employee.exceptions.InvalidTokenException;
import com.employee.repository.UserRepository;
import com.employee.repository.UserRoleRepository;
import com.employee.services.AuditService;
import com.employee.services.AuthService;
import com.employee.services.EmailService;
import com.employee.utils.GeneratePassword;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository      userRepository;
    private final UserRoleRepository  userRoleRepository;
    private final AuthenticationManager authenticationManager;
    private final JwtUtils            jwtUtils;
    private final PasswordEncoder     passwordEncoder;
    private final EmailService        emailService;
    private final AuditService        auditService;   // ← injected

    @Override
    public LoginResponse login(LoginRequest request) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.getUsername(), request.getPassword()));
        } catch (DisabledException e) {
            throw new DisabledException("This account has been deactivated.");
        } catch (BadCredentialsException e) {
            throw new BadCredentialsException("Invalid username or password.");
        }

        User user;
        if (request.getUsername().contains("@")) {
            user = userRepository.findByEmployeeCompanyEmail(request.getUsername())
                    .orElseThrow(() -> new EmployeeNotFoundException("User not found"));
        } else {
            user = userRepository.findById(request.getUsername())
                    .orElseThrow(() -> new EmployeeNotFoundException("User not found"));
        }

        if (!user.getIsUserActive() || !user.getEmployee().getIsEmployeeActive())
            throw new DisabledException("This account has been deactivated.");

        List<String> roles = userRoleRepository.findByEmployeeEmpId(user.getEmpId())
                .stream().map(r -> r.getRole().getRole().name()).toList();

        String accessToken  = jwtUtils.generateAccessToken(
                user.getEmpId(), user.getEmployee().getCompanyEmail(),
                user.getEmployee().getName(), roles);
        String refreshToken = jwtUtils.generateRefreshToken(user.getEmpId());

        // ── AUDIT ──────────────────────────────────────────────────────────────
        auditService.log(user.getEmpId(), "LOGIN",
                "Employee " + user.getEmpId() + " logged in");

        return LoginResponse.builder().token(accessToken).refreshToken(refreshToken).build();
    }

    @Override
    public LoginResponse refreshToken(RefreshTokenRequest request) {
        String refreshToken = request.getRefreshToken();
        String empId = jwtUtils.extractUsername(refreshToken);

        User user = userRepository.findById(empId)
                .orElseThrow(() -> new EmployeeNotFoundException("User not found: " + empId));

        if (!jwtUtils.validateToken(refreshToken, empId))
            throw new InvalidTokenException("Invalid or expired refresh token");
        if (!user.getIsUserActive() || !user.getEmployee().getIsEmployeeActive())
            throw new DisabledException("Account deactivated.");

        List<String> roles = userRoleRepository.findByEmployeeEmpId(empId)
                .stream().map(r -> r.getRole().getRole().name()).toList();

        String newAccessToken = jwtUtils.generateAccessToken(
                empId, user.getEmployee().getCompanyEmail(),
                user.getEmployee().getName(), roles);

        // Token refresh is a routine operation — log at DEBUG level, no audit entry needed
        return LoginResponse.builder().token(newAccessToken).refreshToken(refreshToken).build();
    }

    @Override
    public Map<String, Object> getCurrentUser(String empId) {
        User user = userRepository.findById(empId)
                .orElseThrow(() -> new EmployeeNotFoundException("User not found: " + empId));
        Employee emp = user.getEmployee();
        List<String> roles = userRoleRepository.findByEmployeeEmpId(empId)
                .stream().map(r -> r.getRole().getRole().name()).toList();
        return Map.of(
                "empId",        emp.getEmpId(),
                "name",         emp.getName(),
                "companyEmail", emp.getCompanyEmail(),
                "roles",        roles);
    }

    @Override
    public void changePassword(String empId, ChangePasswordDTO request) {
        User user = userRepository.findById(empId)
                .orElseThrow(() -> new EmployeeNotFoundException("User not found: " + empId));
        if (!passwordEncoder.matches(request.getOldPassword(), user.getPassword()))
            throw new BadCredentialsException("Current password is incorrect");

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        // ── AUDIT ──────────────────────────────────────────────────────────────
        auditService.log(empId, "CHANGE_PASSWORD",
                "Employee " + empId + " changed their own password");
    }

    @Override
    public void resetPassword(String empId) {
        User user = userRepository.findById(empId)
                .orElseThrow(() -> new EmployeeNotFoundException("User not found: " + empId));
        Employee employee = user.getEmployee();
        String rawPassword = GeneratePassword.generatePassword(8);
        user.setPassword(passwordEncoder.encode(rawPassword));
        userRepository.save(user);

        emailService.sendResetPasswordEmail(employee.getEmpId(),
                employee.getName(), employee.getCompanyEmail(), rawPassword);

        // ── AUDIT ──────────────────────────────────────────────────────────────
        // Actor is the admin who triggered the reset (resolved in controller via Authentication)
        // We log here using the target empId; controller can also call auditService if needed
        auditService.log("ADMIN_ACTION", "RESET_PASSWORD",
                "Password reset triggered for employee " + empId);
    }
}
