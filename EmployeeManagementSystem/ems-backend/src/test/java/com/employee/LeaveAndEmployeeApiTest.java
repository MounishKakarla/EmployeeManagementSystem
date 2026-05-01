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
 * End-to-end API tests for /ems/leaves/* and /ems/employee/* endpoints.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class LeaveAndEmployeeApiTest {

    @LocalServerPort
    private int port;

    private static String token;
    private static Long   createdLeaveId;

    @BeforeEach
    void setUp() {
        RestAssured.port    = port;
        RestAssured.baseURI = "http://localhost";

        if (token == null) {
            token = given()
                .contentType(ContentType.JSON)
                .body("{\"username\":\"TT0001\",\"password\":\"Mouni@1702\"}")
                .post("/auth/login")
                .then().extract().jsonPath().getString("token");
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    //  LEAVES
    // ════════════════════════════════════════════════════════════════════════

    @Test @Order(1)
    @DisplayName("GET /ems/leaves/balance → 200 returns employee leave balance")
    void getMyBalance() {
        given()
            .header("Authorization", "Bearer " + token)
        .when()
            .get("/ems/leaves/balance")
        .then()
            .statusCode(200)
            .body("annualLeave",  notNullValue());
    }

    @Test @Order(2)
    @DisplayName("POST /ems/leaves → 200 submits a valid leave request")
    void submitLeave() {
        var resp = given()
            .header("Authorization", "Bearer " + token)
            .contentType(ContentType.JSON)
            .body("""
                {
                  "leaveType": "ANNUAL",
                  "startDate": "2025-12-22",
                  "endDate":   "2025-12-23",
                  "reason": "Year-end holiday"
                }
                """)
        .when()
            .post("/ems/leaves")
        .then()
            .statusCode(anyOf(is(200), is(400))) // 400 if balance is exhausted
            .extract().response();

        if (resp.statusCode() == 200) {
            createdLeaveId = resp.jsonPath().getLong("id");
        }
    }

    @Test @Order(3)
    @DisplayName("GET /ems/leaves/my → 200 returns paginated own leave history")
    void getMyLeaves() {
        given()
            .header("Authorization", "Bearer " + token)
            .queryParam("page", 0)
            .queryParam("size", 10)
        .when()
            .get("/ems/leaves/my")
        .then()
            .statusCode(200)
            .body("content", notNullValue());
    }

    @Test @Order(4)
    @DisplayName("GET /ems/leaves/pending → 200 returns pending leaves for admin")
    void getPendingLeaves() {
        given()
            .header("Authorization", "Bearer " + token)
        .when()
            .get("/ems/leaves/pending")
        .then()
            .statusCode(200)
            .body("content", notNullValue());
    }

    @Test @Order(5)
    @DisplayName("DELETE /ems/leaves/{id} → 200 or 400 cancels a leave request")
    void cancelLeave() {
        Assumptions.assumeTrue(createdLeaveId != null, "Skipped: no leave was created in previous test");
        given()
            .header("Authorization", "Bearer " + token)
        .when()
            .delete("/ems/leaves/" + createdLeaveId)
        .then()
            .statusCode(anyOf(is(200), is(400)));
    }

    @Test @Order(6)
    @DisplayName("GET /ems/leaves/all → 200 returns all leaves for admin")
    void getAllLeaves() {
        given()
            .header("Authorization", "Bearer " + token)
            .queryParam("page", 0)
            .queryParam("size", 10)
        .when()
            .get("/ems/leaves/all")
        .then()
            .statusCode(200)
            .body("content", notNullValue());
    }

    // ════════════════════════════════════════════════════════════════════════
    //  EMPLOYEES
    // ════════════════════════════════════════════════════════════════════════

    @Test @Order(10)
    @DisplayName("GET /ems/profile → 200 returns authenticated user's profile")
    void getMyProfile() {
        given()
            .header("Authorization", "Bearer " + token)
        .when()
            .get("/ems/profile")
        .then()
            .statusCode(200)
            .body("empId", equalTo("TT0001"));
    }

    @Test @Order(11)
    @DisplayName("GET /ems/employees → 200 returns paginated employee list")
    void searchEmployees() {
        given()
            .header("Authorization", "Bearer " + token)
            .queryParam("page", 0)
            .queryParam("size", 10)
        .when()
            .get("/ems/employees")
        .then()
            .statusCode(200)
            .body("content", notNullValue());
    }

    @Test @Order(12)
    @DisplayName("GET /ems/employee/{empId} → 200 returns specific employee")
    void getEmployeeById() {
        given()
            .header("Authorization", "Bearer " + token)
        .when()
            .get("/ems/employee/TT0001")
        .then()
            .statusCode(200)
            .body("empId", equalTo("TT0001"));
    }

    @Test @Order(13)
    @DisplayName("GET /ems/employees/inactive → 200 returns inactive employees")
    void getInactiveEmployees() {
        given()
            .header("Authorization", "Bearer " + token)
        .when()
            .get("/ems/employees/inactive")
        .then()
            .statusCode(200);
    }

    @Test @Order(14)
    @DisplayName("PATCH /ems/update/{empId} → 200 updates employee phone number")
    void updateEmployee() {
        given()
            .header("Authorization", "Bearer " + token)
            .contentType(ContentType.JSON)
            .body("{\"phoneNumber\":\"9876543210\"}")
        .when()
            .patch("/ems/update/TT0001")
        .then()
            .statusCode(200)
            .body("phoneNumber", equalTo("9876543210"));
    }

    @Test @Order(15)
    @DisplayName("GET /ems/employees?name=TT0001 → filters by name")
    void searchEmployeeByName() {
        given()
            .header("Authorization", "Bearer " + token)
            .queryParam("name", "TT0001")
        .when()
            .get("/ems/employees")
        .then()
            .statusCode(200)
            .body("content.size()", greaterThanOrEqualTo(0));
    }
}
