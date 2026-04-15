package com.employee.config;

import java.util.Collection;
import java.util.stream.Collectors;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import com.employee.entity.User;
import com.employee.repository.UserRoleRepository;

import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
public class LoginDetails implements UserDetails {

    private final User user;
    private final UserRoleRepository userRoleRepository;

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return userRoleRepository.findByEmployeeEmpId(user.getEmpId()).stream()
                .map(r -> new SimpleGrantedAuthority("ROLE_" + r.getRole().getRole().name()))
                .collect(Collectors.toList());
    }

    @Override public String  getPassword()            { return user.getPassword(); }
    @Override public String  getUsername()            { return user.getEmpId(); }
    @Override public boolean isEnabled()              { return user.getIsUserActive(); }
    @Override public boolean isAccountNonExpired()    { return true; }
    @Override public boolean isAccountNonLocked()     { return true; }
    @Override public boolean isCredentialsNonExpired(){ return true; }
}
