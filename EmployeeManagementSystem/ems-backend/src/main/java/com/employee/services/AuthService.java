package com.employee.services;
import java.util.Map;
import com.employee.config.*;
import com.employee.dto.ChangePasswordDTO;
public interface AuthService {
    LoginResponse login(LoginRequest request);
    LoginResponse refreshToken(RefreshTokenRequest request);
    void resetPassword(String empId);
    void changePassword(String empId, ChangePasswordDTO request);
    Map<String, Object> getCurrentUser(String empId);
    void savePushToken(String empId, String pushToken);
}
