package com.employee;

import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import org.junit.jupiter.api.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;

import static io.restassured.RestAssured.given;
import static io.restassured.RestAssured.when;
import static org.hamcrest.Matchers.*;

/**
 * End-to-end API tests for /auth/* endpoints.
 *
 * Prerequisites:
 *   - Run with Spring profile "test" → H2 in-memory DB is used.
 *   - data-test.sql seeds TT0001 with password "Mouni@1702" (bcrypt).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class AuthApiTest {

    @LocalServerPort
    private int port;

    /** JWT cookie extracted from login response, reused in subsequent tests. */
    private static String accessToken;

    @BeforeEach
    void setUp() {
        RestAssured.port = port;
        RestAssured.baseURI = "http://localhost";
    }

    // ── POST /auth/login ──────────────────────────────────────────────────────

    @Test
    @Order(1)
    @DisplayName("POST /auth/login → 200 with tokens for valid credentials")
    void loginSuccess() {
        var resp = given()
            .contentType(ContentType.JSON)
            .body("{\"username\":\"TT0001\",\"password\":\"Mouni@1702\"}")
        .when()
            .post("/auth/login")
        .then()
            .statusCode(200)
            .body("message", equalTo("Login successful"))
            .body("token", not(emptyOrNullString()))
            .cookie("access_token")
            .extract().response();

        accessToken = resp.jsonPath().getString("token");
    }

    @Test
    @Order(2)
    @DisplayName("POST /auth/login → 401 for wrong password")
    void loginBadPassword() {
        given()
            .contentType(ContentType.JSON)
            .body("{\"username\":\"TT0001\",\"password\":\"WRONG\"}")
        .when()
            .post("/auth/login")
        .then()
            .statusCode(401);
    }

    @Test
    @Order(3)
    @DisplayName("POST /auth/login → 401 for non-existent user")
    void loginUnknownUser() {
        given()
            .contentType(ContentType.JSON)
            .body("{\"username\":\"GHOST999\",\"password\":\"anything\"}")
        .when()
            .post("/auth/login")
        .then()
            .statusCode(401);
    }

    // ── GET /auth/me ──────────────────────────────────────────────────────────

    @Test
    @Order(4)
    @DisplayName("GET /auth/me → 200 returns current user details")
    void getCurrentUser() {
        given()
            .header("Authorization", "Bearer " + accessToken)
        .when()
            .get("/auth/me")
        .then()
            .statusCode(200)
            .body("empId", equalTo("TT0001"));
    }

    @Test
    @Order(5)
    @DisplayName("GET /auth/me → 401 without token")
    void getCurrentUserUnauthenticated() {
        when()
            .get("/auth/me")
        .then()
            .statusCode(401);
    }

    // ── POST /auth/logout ─────────────────────────────────────────────────────

    @Test
    @Order(6)
    @DisplayName("POST /auth/logout → 200 clears cookies")
    void logout() {
        given()
            .header("Authorization", "Bearer " + accessToken)
        .when()
            .post("/auth/logout")
        .then()
            .statusCode(200)
            .body("message", equalTo("Logged out successfully"))
            .cookie("access_token", emptyOrNullString());
    }

    // ── PUT /auth/changePassword ───────────────────────────────────────────────

    @Test
    @Order(7)
    @DisplayName("PUT /auth/changePassword → 400 when current password is wrong")
    void changePasswordWrongCurrentPassword() {
        // Re-login to get a fresh token
        var resp = given()
            .contentType(ContentType.JSON)
            .body("{\"username\":\"TT0001\",\"password\":\"Mouni@1702\"}")
            .post("/auth/login").then().extract().response();
        String token = resp.jsonPath().getString("token");

        given()
            .header("Authorization", "Bearer " + token)
            .contentType(ContentType.JSON)
            .body("{\"currentPassword\":\"WrongPass\",\"newPassword\":\"NewPass@123\"}")
        .when()
            .put("/auth/changePassword")
        .then()
            .statusCode(anyOf(is(400), is(401)));
    }
}
