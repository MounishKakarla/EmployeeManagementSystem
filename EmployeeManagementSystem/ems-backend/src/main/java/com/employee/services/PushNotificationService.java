package com.employee.services;

import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.employee.entity.Notification;
import com.employee.entity.User;
import com.employee.repository.NotificationRepository;
import com.employee.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PushNotificationService {

    private static final Logger log = LoggerFactory.getLogger(PushNotificationService.class);
    private static final String EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

    private final UserRepository         userRepository;
    private final NotificationRepository notificationRepository;
    private final RestTemplate           restTemplate;

    public void sendLeaveStatusNotification(String empId, String status,
                                             String leaveType, String reviewNotes,
                                             Long leaveId) {
        boolean approved = "APPROVED".equals(status);
        String title = approved ? "Leave Approved ✅" : "Leave Rejected ❌";
        String friendly = leaveType.replace('_', ' ').toLowerCase();
        String body = approved
                ? "Your " + friendly + " leave request has been approved."
                : "Your " + friendly + " leave request has been rejected."
                  + (reviewNotes != null && !reviewNotes.isBlank() ? " Note: " + reviewNotes : "");
        push(empId, title, body, "LEAVE", leaveId);
    }

    public void sendTimesheetStatusNotification(String empId, String status,
                                                 String weekStart, String reviewNotes,
                                                 Long timesheetId) {
        boolean approved = "APPROVED".equals(status);
        String title = approved ? "Timesheet Approved ✅" : "Timesheet Rejected ❌";
        String body = approved
                ? "Your timesheet for week of " + weekStart + " has been approved."
                : "Your timesheet for week of " + weekStart + " has been rejected."
                  + (reviewNotes != null && !reviewNotes.isBlank() ? " Note: " + reviewNotes : "");
        push(empId, title, body, "TIMESHEET", timesheetId);
    }

    // ── private ────────────────────────────────────────────────────────────────

    private void push(String empId, String title, String body, String category, Long relatedId) {
        // 1. Always persist to DB so the in-app notification centre has history
        try {
            notificationRepository.save(
                    Notification.builder()
                            .empId(empId)
                            .title(title)
                            .body(body)
                            .category(category)
                            .relatedId(relatedId)
                            .read(false)
                            .build());
        } catch (Exception e) {
            log.warn("Failed to persist notification for {} : {}", empId, e.getMessage());
        }

        // 2. Send device push if the user has a registered token
        User user = userRepository.findById(empId).orElse(null);
        if (user == null || user.getPushToken() == null || user.getPushToken().isBlank()) return;

        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("to",        user.getPushToken());
            payload.put("title",     title);
            payload.put("body",      body);
            payload.put("sound",     "default");
            payload.put("channelId", "default");
            payload.put("priority",  "high");
            payload.put("data",      Map.of("category", category, "relatedId",
                                             relatedId != null ? relatedId : 0));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Accept", "application/json");

            restTemplate.postForObject(
                    EXPO_PUSH_URL,
                    new HttpEntity<>(payload, headers),
                    String.class);

            log.info("Push sent → {} | {}", empId, title);
        } catch (Exception e) {
            log.warn("Push failed → {} : {}", empId, e.getMessage());
        }
    }
}
