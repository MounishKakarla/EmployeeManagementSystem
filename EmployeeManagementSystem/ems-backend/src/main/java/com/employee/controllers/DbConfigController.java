package com.employee.controllers;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.regex.*;

@RestController
@RequestMapping("/ems")
public class DbConfigController {

    @Value("${spring.datasource.url}")      private String datasourceUrl;
    @Value("${spring.datasource.username}") private String datasourceUsername;
    @Value("${spring.datasource.password}") private String datasourcePassword;

    @GetMapping("/db-config")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<Map<String, Object>> getDbConfig() {
        Map<String, Object> config = parseJdbcUrl(datasourceUrl);
        config.put("user",     datasourceUsername);
        config.put("password", datasourcePassword);
        return ResponseEntity.ok(config);
    }

    private Map<String, Object> parseJdbcUrl(String url) {
        Map<String, Object> cfg = new HashMap<>();
        Pattern p = Pattern.compile("jdbc:(postgresql|mysql)://([^:/]+)(?::(\\d+))?/([^?]+)");
        Matcher m = p.matcher(url);
        if (m.find()) {
            String type = m.group(1);
            cfg.put("db_type",  type.equals("postgresql") ? "postgres" : "mysql");
            cfg.put("host",     m.group(2));
            cfg.put("port",     m.group(3) != null ? Integer.parseInt(m.group(3)) : (type.equals("postgresql") ? 5432 : 3306));
            cfg.put("database", m.group(4));
            return cfg;
        }
        if (url.startsWith("jdbc:sqlite:")) {
            cfg.put("db_type", "sqlite"); cfg.put("host", ""); cfg.put("port", 0);
            cfg.put("database", url.replace("jdbc:sqlite:", ""));
            return cfg;
        }
        cfg.put("db_type", "postgres"); cfg.put("host", "localhost"); cfg.put("port", 5432); cfg.put("database", "");
        return cfg;
    }
}
