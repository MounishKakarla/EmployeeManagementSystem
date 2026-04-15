package com.employee.servicesImpl;

import java.time.LocalDate;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.employee.dto.EmployeeDTO;
import com.employee.entity.Employee;
import com.employee.entity.Roles;
import com.employee.entity.User;
import com.employee.entity.UserRoles;
import com.employee.enums.RolesEnum;
import com.employee.exceptions.DuplicateEmployeeException;
import com.employee.exceptions.EmployeeNotFoundException;
import com.employee.exceptions.InactiveEmployeeException;
import com.employee.repository.EmployeeRepository;
import com.employee.repository.RoleRepository;
import com.employee.repository.UserRepository;
import com.employee.repository.UserRoleRepository;
import com.employee.services.AuditService;
import com.employee.services.EmailService;
import com.employee.services.EmployeeService;
import com.employee.utils.GeneratePassword;
import com.employee.utils.UserRoleId;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class EmployeeServiceImpl implements EmployeeService {

    private final EmployeeRepository  employeeRepository;
    private final RoleRepository      roleRepository;
    private final UserRepository      userRepository;
    private final PasswordEncoder     passwordEncoder;
    private final EmailService        emailService;
    private final UserRoleRepository  userRoleRepository;
    private final AuditService        auditService;   // ← injected

    // ── Create ─────────────────────────────────────────────────────────────────
    @Override
    @Transactional
    public EmployeeDTO createEmployee(EmployeeDTO dto) {

        if (employeeRepository.existsByCompanyEmail(dto.getCompanyEmail()))
            throw new DuplicateEmployeeException("Company email already in use: " + dto.getCompanyEmail());
        if (employeeRepository.existsByPersonalEmail(dto.getPersonalEmail()))
            throw new DuplicateEmployeeException("Personal email already in use: " + dto.getPersonalEmail());
        if (employeeRepository.existsByPhoneNumber(dto.getPhoneNumber()))
            throw new DuplicateEmployeeException("Phone number already in use: " + dto.getPhoneNumber());

        Employee employee = Employee.builder()
                .name(dto.getName())
                .companyEmail(dto.getCompanyEmail())
                .personalEmail(dto.getPersonalEmail())
                .phoneNumber(dto.getPhoneNumber())
                .address(dto.getAddress())
                .department(dto.getDepartment())
                .designation(dto.getDesignation())
                .skills(dto.getSkills())
                .dateOfJoin(dto.getDateOfJoin())
                .dateOfBirth(dto.getDateOfBirth())
                .description(dto.getDescription())
                .build();

        Employee saved = employeeRepository.save(employee);
        String rawPassword = GeneratePassword.generatePassword(8);

        User user = User.builder().employee(saved)
                .password(passwordEncoder.encode(rawPassword)).build();
        userRepository.save(user);

        Set<UserRoles> userRoles = dto.getRoles().stream().map(roleEnum -> {
            Roles role = roleRepository.findByRole(roleEnum)
                    .orElseThrow(() -> new IllegalArgumentException("Role not found: " + roleEnum));
            return UserRoles.builder().employee(saved).role(role)
                    .id(new UserRoleId(saved.getEmpId(), role.getRoleId())).build();
        }).collect(Collectors.toSet());
        saved.setRoles(userRoles);

        emailService.sendLoginDetails(saved.getPersonalEmail(), saved.getEmpId(),
                saved.getCompanyEmail(), rawPassword, saved.getName());

        // ── AUDIT ──────────────────────────────────────────────────────────────
        String actor = currentUser();
        auditService.log(actor, "CREATE_EMPLOYEE",
                "Created employee " + saved.getEmpId() + " (" + saved.getName() + ")");

        return employeeDetails(saved);
    }

    // ── Read ───────────────────────────────────────────────────────────────────
    @Override
    public EmployeeDTO getEmployeeById(String empId) {
        Employee employee = employeeRepository.findByEmpIdAndIsEmployeeActiveTrue(empId);
        if (employee == null)
            throw new EmployeeNotFoundException("Employee not found: " + empId);
        return employeeDetails(employee);
    }

    @Override
    public Page<EmployeeDTO> getAllEmployees(Pageable pageable) {
        return employeeRepository.findByIsEmployeeActiveTrue(pageable).map(this::employeeDetails);
    }

    @Override
    public Page<EmployeeDTO> getEmployees(String name, String department,
                                           LocalDate date, String skill, Pageable pageable) {
        if (name       != null && !name.isBlank())
            return employeeRepository.findByNameContainingIgnoreCaseAndIsEmployeeActiveTrue(name, pageable).map(this::employeeDetails);
        if (department != null && !department.isBlank())
            return employeeRepository.findByDepartmentContainingAndActive(department, pageable).map(this::employeeDetails);
        if (date       != null)
            return employeeRepository.findByDateOfJoinGreaterThanEqualAndIsEmployeeActiveTrue(date, pageable).map(this::employeeDetails);
        if (skill      != null && !skill.isBlank())
            return employeeRepository.findBySkillContainingAndActive(skill, pageable).map(this::employeeDetails);
        return employeeRepository.findByIsEmployeeActiveTrue(pageable).map(this::employeeDetails);
    }

    @Override
    public Page<EmployeeDTO> getInactiveEmployees(Pageable pageable) {
        return employeeRepository.findByIsEmployeeActiveFalse(pageable).map(this::employeeDetails);
    }

    @Override
    public EmployeeDTO getInactiveEmployeeById(String empId) {
        Employee employee = employeeRepository.findByEmpIdAndIsEmployeeActiveFalse(empId);
        if (employee == null)
            throw new EmployeeNotFoundException("Inactive employee not found: " + empId);
        return employeeDetails(employee);
    }

    // ── Delete (soft) ──────────────────────────────────────────────────────────
    @Override
    @Transactional
    public void deleteEmployee(String empId) {
        Employee employee = getActiveEmployee(empId);
        employee.setIsEmployeeActive(false);
        employee.setDateOfExit(LocalDate.now());
        if (employee.getUser() != null) employee.getUser().setIsUserActive(false);
        employeeRepository.save(employee);

        // ── AUDIT ──────────────────────────────────────────────────────────────
        auditService.log(currentUser(), "DEACTIVATE_EMPLOYEE",
                "Deactivated employee " + empId + " (" + employee.getName() + ")");
    }

    // ── Update ─────────────────────────────────────────────────────────────────
    @Override
    @Transactional
    public EmployeeDTO updateFields(String empId, EmployeeDTO dto) {
        Employee employee = getActiveEmployee(empId);

        StringBuilder changes = new StringBuilder();
        if (dto.getName()          != null) { changes.append("name; ");          employee.setName(dto.getName()); }
        if (dto.getPhoneNumber()   != null) { changes.append("phoneNumber; ");   employee.setPhoneNumber(dto.getPhoneNumber()); }
        if (dto.getAddress()       != null) { changes.append("address; ");       employee.setAddress(dto.getAddress()); }
        if (dto.getPersonalEmail() != null) { changes.append("personalEmail; "); employee.setPersonalEmail(dto.getPersonalEmail()); }
        if (dto.getDepartment()    != null) { changes.append("department; ");    employee.setDepartment(dto.getDepartment()); }
        if (dto.getDesignation()   != null) { changes.append("designation; ");   employee.setDesignation(dto.getDesignation()); }
        if (dto.getDescription()   != null) { changes.append("description; ");   employee.setDescription(dto.getDescription()); }
        if (dto.getSkills()        != null) { changes.append("skills; ");        employee.setSkills(dto.getSkills()); }

        EmployeeDTO result = employeeDetails(employeeRepository.save(employee));

        // ── AUDIT ──────────────────────────────────────────────────────────────
        auditService.log(currentUser(), "UPDATE_EMPLOYEE",
                "Updated [" + changes.toString().trim() + "] for employee " + empId);

        return result;
    }

    // ── Private helpers ────────────────────────────────────────────────────────
    private Employee getActiveEmployee(String empId) {
        Employee employee = employeeRepository.findById(empId)
                .orElseThrow(() -> new EmployeeNotFoundException("Employee not found: " + empId));
        if (!employee.getIsEmployeeActive())
            throw new InactiveEmployeeException("Employee " + empId + " is inactive");
        return employee;
    }

    private EmployeeDTO employeeDetails(Employee employee) {
        Set<RolesEnum> roles = userRoleRepository.findByEmployeeEmpId(employee.getEmpId())
                .stream().map(ur -> ur.getRole().getRole()).collect(Collectors.toSet());
        return EmployeeDTO.builder()
                .empId(employee.getEmpId()).name(employee.getName())
                .companyEmail(employee.getCompanyEmail()).personalEmail(employee.getPersonalEmail())
                .phoneNumber(employee.getPhoneNumber()).address(employee.getAddress())
                .department(employee.getDepartment()).designation(employee.getDesignation())
                .skills(employee.getSkills()).dateOfJoin(employee.getDateOfJoin())
                .dateOfBirth(employee.getDateOfBirth()).description(employee.getDescription())
                .dateOfExit(employee.getDateOfExit()).isEmployeeActive(employee.getIsEmployeeActive())
                .roles(roles).build();
    }

    /** Resolve the currently authenticated empId, fall back to "SYSTEM" */
    private String currentUser() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            return (auth != null && auth.isAuthenticated()) ? auth.getName() : "SYSTEM";
        } catch (Exception e) { return "SYSTEM"; }
    }
}
