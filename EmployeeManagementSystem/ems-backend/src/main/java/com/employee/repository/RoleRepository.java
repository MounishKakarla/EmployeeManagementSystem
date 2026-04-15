package com.employee.repository;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import com.employee.entity.Roles;
import com.employee.enums.RolesEnum;
public interface RoleRepository extends JpaRepository<Roles, Integer> {
    Optional<Roles> findByRole(RolesEnum role);
}
