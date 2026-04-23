package com.employee.utils;
import java.io.Serializable;
import org.hibernate.engine.spi.SharedSessionContractImplementor;
import org.hibernate.id.IdentifierGenerator;
public class EmployeeIdGenerator implements IdentifierGenerator {
    @Override
    public Serializable generate(SharedSessionContractImplementor session, Object object) {
        Long seq = session.createNativeQuery("SELECT nextval('emp_id_seq')", Long.class).getSingleResult();
        return "TT" + String.format("%04d", seq);
    }
}
