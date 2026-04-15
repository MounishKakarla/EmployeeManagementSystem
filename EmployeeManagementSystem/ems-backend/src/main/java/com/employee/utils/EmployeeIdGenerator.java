package com.employee.utils;
import java.io.Serializable;
import org.hibernate.engine.spi.SharedSessionContractImplementor;
import org.hibernate.id.IdentifierGenerator;
public class EmployeeIdGenerator implements IdentifierGenerator {
    @Override
    public Serializable generate(SharedSessionContractImplementor session, Object object) {
        Long seq = ((Number) session.createNativeQuery("SELECT nextval('emp_id_seq')").getSingleResult()).longValue();
        return "TT" + String.format("%04d", seq);
    }
}
