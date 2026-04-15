package com.employee.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import com.employee.entity.LeaveBalance;

@Repository
public interface LeaveBalanceRepository extends JpaRepository<LeaveBalance, Long> {

    /** Primary lookup — empId + year is unique */
    Optional<LeaveBalance> findByEmployeeEmpIdAndYear(String empId, Integer year);

    /** Used by year-end scheduler to check if new year record already exists */
    boolean existsByEmployeeEmpIdAndYear(String empId, Integer year);
}