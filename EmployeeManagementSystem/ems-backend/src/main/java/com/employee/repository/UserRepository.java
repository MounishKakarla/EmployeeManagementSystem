package com.employee.repository;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import com.employee.entity.User;
@Repository
public interface UserRepository extends JpaRepository<User, String> {
    Optional<User> findByEmployeeCompanyEmail(String email);
}
