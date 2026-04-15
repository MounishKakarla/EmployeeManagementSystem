package com.employee.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

import com.employee.utils.UserRoleId;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Data
@Table(name = "user_roles")
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserRoles {

    @EmbeddedId
    private UserRoleId id;

    @ManyToOne
    @MapsId("empId")
    @JoinColumn(name = "emp_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Employee employee;

    @ManyToOne
    @MapsId("roleId")
    @JoinColumn(name = "role_id")
    private Roles role;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
