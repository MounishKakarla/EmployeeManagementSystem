package com.employee.config;

import java.security.Key;
import java.util.Date;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;

@Component
public class JwtUtils {

    @Value("${ems.jwt.secret}")
    private String secret;

    @Value("${ems.jwt.expiration}")
    private long expiration;

    @Value("${ems.jwt.refreshExpiration}")
    private long refreshExpiration;

    private Key getSigningKey() {
        return Keys.hmacShaKeyFor(secret.getBytes());
    }

    public String generateAccessToken(String empId, String companyEmail, String name, List<String> roles) {
        return Jwts.builder().setSubject(empId)
                .claim("email", companyEmail).claim("name", name)
                .claim("roles", roles).claim("type", "ACCESS")
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getSigningKey(), SignatureAlgorithm.HS256).compact();
    }

    public String generateRefreshToken(String empId) {
        return Jwts.builder().setSubject(empId).claim("type", "REFRESH")
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + refreshExpiration))
                .signWith(getSigningKey(), SignatureAlgorithm.HS256).compact();
    }

    public Claims extractAllClaims(String token) {
        return Jwts.parserBuilder().setSigningKey(getSigningKey()).build()
                .parseClaimsJws(token).getBody();
    }

    public String extractUsername(String token) { return extractAllClaims(token).getSubject(); }
    public Date   extractExpiration(String token) { return extractAllClaims(token).getExpiration(); }
    public String extractTokenType(String token) { return extractAllClaims(token).get("type", String.class); }
    @SuppressWarnings("unchecked")
    public List<String> extractRoles(String token) { return extractAllClaims(token).get("roles", List.class); }
    public boolean isTokenExpired(String token) { return extractExpiration(token).before(new Date()); }
    public boolean validateToken(String token, String empId) { return extractUsername(token).equals(empId) && !isTokenExpired(token); }
    public boolean isAccessToken(String token)  { return "ACCESS".equals(extractTokenType(token)); }
    public boolean isRefreshToken(String token) { return "REFRESH".equals(extractTokenType(token)); }
}
