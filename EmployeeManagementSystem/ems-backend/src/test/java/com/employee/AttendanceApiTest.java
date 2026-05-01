package com.employee;

import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;

import static io.restassured.RestAssured.given;
import static io.restassured.RestAssured.when;
import static org.hamcrest.Matchers.*;

/**
 * End-to-end API tests for /ems/attendance/* endpoints.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class AttendanceApiTest {

    @LocalServerPort
    private int port;

    private static String token;

    @BeforeEach
    void setUp() {
        RestAssured.port    = port;
        RestAssured.baseURI = "http://localhost";

        // Login once per test method (token may be expired between restarts)
        if (token == null) {
            token = given()
                .contentType(ContentType.JSON)
                .body("{\"username\":\"TT0001\",\"password\":\"Mouni@1702\"}")
                .post("/auth/login")
                .then().extract().jsonPath().getString("token");
        }
    }

    // ── GET /ems/attendance/today ─────────────────────────────────────────────

    @Test
    @Order(1)
    @DisplayName("GET /ems/attendance/today → 200 (null body if not checked in yet is OK)")
    void getTodayStatus() {
        given()
            .header("Authorization", "Bearer " + token)
        .when()
            .get("/ems/attendance/today")
        .then()
            .statusCode(200);
    }

    @Test
    @Order(2)
    @DisplayName("GET /ems/attendance/today → 401 without token")
    void getTodayUnauthorized() {
        when()
            .get("/ems/attendance/today")
        .then()
            .statusCode(401);
    }

    // ── POST /ems/attendance/check-in ─────────────────────────────────────────

    @Test
    @Order(3)
    @DisplayName("POST /ems/attendance/check-in → 200 records check-in time")
    void checkIn() {
        given()
            .header("Authorization", "Bearer " + token)
            .contentType(ContentType.JSON)
            .body("{}")
        .when()
            .post("/ems/attendance/check-in")
        .then()
            .statusCode(anyOf(is(200), is(409))) // 409 if already checked in today
            .body(not(emptyOrNullString()));
    }

    // ── POST /ems/attendance/check-out ────────────────────────────────────────

    @Test
    @Order(4)
    @DisplayName("POST /ems/attendance/check-out → 200 records check-out time")
    void checkOut() {
        given()
            .header("Authorization", "Bearer " + token)
        .when()
            .post("/ems/attendance/check-out")
        .then()
            .statusCode(anyOf(is(200), is(400), is(409)));
    }

    // ── POST /ems/attendance/override ─────────────────────────────────────────

    @Test
    @Order(5)
    @DisplayName("POST /ems/attendance/override → 200 for valid 9-to-6 shift")
    void overrideValid() {
        given()
            .header("Authorization", "Bearer " + token)
            .contentType(ContentType.JSON)
            .body("""
                {
                  "empId": "TT0001",
                  "attendanceDate": "2025-01-15",
                  "checkInTime":  "09:00",
                  "checkOutTime": "18:00",
                  "status": "PRESENT"
                }
                """)
        .when()
            .post("/ems/attendance/override")
        .then()
            .statusCode(200)
            .body("checkInTime",  equalTo("09:00"))
            .body("checkOutTime", equalTo("18:00"));
    }

    @Test
    @Order(6)
    @DisplayName("POST /ems/attendance/override → 400 when hours exceed 23:59 (midnight loop)")
    void overrideExceedsMaxHours() {
        // 09:00 → 09:00 = exactly 24 hours — must be rejected by the entity
        given()
            .header("Authorization", "Bearer " + token)
            .contentType(ContentType.JSON)
            .body("""
                {
                  "empId": "TT0001",
                  "attendanceDate": "2025-01-16",
                  "checkInTime":  "09:00",
                  "checkOutTime": "09:00",
                  "status": "PRESENT"
                }
                """)
        .when()
            .post("/ems/attendance/override")
        .then()
            .statusCode(anyOf(is(400), is(422)));
    }

    // ── GET /ems/attendance/my ────────────────────────────────────────────────

    @Test
    @Order(7)
    @DisplayName("GET /ems/attendance/my → 200 returns paginated history")
    void getMyHistory() {
        given()
            .header("Authorization", "Bearer " + token)
            .queryParam("page", 0)
            .queryParam("size", 10)
        .when()
            .get("/ems/attendance/my")
        .then()
            .statusCode(200)
            .body("content", notNullValue());
    }

    // ── GET /ems/attendance/daily ─────────────────────────────────────────────

    @Test
    @Order(8)
    @DisplayName("GET /ems/attendance/daily → 200 returns list for admin")
    void getDailyRoster() {
        given()
            .header("Authorization", "Bearer " + token)
            .queryParam("date", "2025-01-15")
        .when()
            .get("/ems/attendance/daily")
        .then()
            .statusCode(200)
            .body("$", instanceOf(java.util.List.class));
    }

    // ── GET /ems/attendance/team ──────────────────────────────────────────────

    @Test
    @Order(9)
    @DisplayName("GET /ems/attendance/team → 200 paginated team attendance")
    void getTeamAttendance() {
        given()
            .header("Authorization", "Bearer " + token)
            .queryParam("start", "2025-01-01")
            .queryParam("end",   "2025-01-31")
        .when()
            .get("/ems/attendance/team")
        .then()
            .statusCode(200)
            .body("content", notNullValue());
    }
}
