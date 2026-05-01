package com.employee.entity;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Set;

import org.hibernate.annotations.GenericGenerator;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "employees")
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Employee {

    @Id
    @GeneratedValue(generator = "emp-id-generator")
    @GenericGenerator(name = "emp-id-generator", strategy = "com.employee.utils.EmployeeIdGenerator")
    @EqualsAndHashCode.Include
    @Column(name = "emp_id")
    private String empId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "company_email", nullable = false, unique = true, updatable = false)
    private String companyEmail;

    @Column(name = "personal_email", nullable = false, unique = true)
    private String personalEmail;

    @Column(name = "phone_number", nullable = false, unique = true)
    private String phoneNumber;

    @Column(name = "address", nullable = false)
    private String address;

    @Column(name = "department", nullable = false, length = 500)
    private String department;

    @Column(name = "designation", nullable = false, length = 500)
    private String designation;

    @Column(name = "skills", nullable = true, length = 1000)
    private String skills;

    @Column(name = "date_of_join", nullable = false)
    private LocalDate dateOfJoin;

    @Column(name = "date_of_birth", nullable = false)
    private LocalDate dateOfBirth;

    @Column(name = "description", nullable = true)
    private String description;

    /** Values: "MALE", "FEMALE", "OTHER" — stored as plain string for flexibility */
    @Column(name = "gender", nullable = true, length = 10)
    private String gender;

    @Column(name = "profile_image", nullable = true, columnDefinition = "TEXT")
    private String profileImage;

    @Column(name = "date_of_exit", nullable = true)
    private LocalDate dateOfExit;

    @Builder.Default
    @Column(name = "is_employee_active", nullable = false)
    private Boolean isEmployeeActive = true;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = LocalDateTime.now();
        if (this.user != null) this.user.setIsUserActive(this.isEmployeeActive);
    }

    @OneToOne(mappedBy = "employee", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @ToString.Exclude
    private User user;

    @OneToMany(mappedBy = "employee", cascade = CascadeType.ALL)
    @ToString.Exclude
    private Set<UserRoles> roles;
}
