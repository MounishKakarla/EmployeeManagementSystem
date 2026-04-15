package com.employee.utils;
import java.io.Serializable;
import jakarta.persistence.Embeddable;
import lombok.*;
@Data @Embeddable @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
public class UserRoleId implements Serializable {
    private String empId;
    private Integer roleId;
}
