package com.employee.repository;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import com.employee.entity.UserRoles;
import com.employee.utils.UserRoleId;
public interface UserRoleRepository extends JpaRepository<UserRoles, UserRoleId> {
    List<UserRoles> findByEmployeeEmpId(String empId);
}
