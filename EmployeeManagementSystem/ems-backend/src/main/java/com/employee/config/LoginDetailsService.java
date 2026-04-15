package com.employee.config;

import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;

import com.employee.entity.User;
import com.employee.repository.UserRepository;
import com.employee.repository.UserRoleRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class LoginDetailsService implements UserDetailsService {

    private final UserRepository     userRepository;
    private final UserRoleRepository userRoleRepository;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user;
        if (username.contains("@")) {
            user = userRepository.findByEmployeeCompanyEmail(username)
                    .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        } else {
            user = userRepository.findById(username)
                    .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        }
        return new LoginDetails(user, userRoleRepository);
    }
}
