package com.employee.controllers;

import java.util.Map;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.employee.dto.NotificationDTO;
import com.employee.entity.Notification;
import com.employee.repository.NotificationRepository;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/ems/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationRepository notifRepo;

    /** GET /ems/notifications/my?page=0&size=20 — paginated notification history */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','EMPLOYEE')")
    @GetMapping("/my")
    public Page<NotificationDTO> getMyNotifications(Authentication auth, Pageable pageable) {
        return notifRepo.findByEmpIdOrderByCreatedAtDesc(auth.getName(), pageable)
                .map(this::toDTO);
    }

    /** GET /ems/notifications/unread-count — how many unread (for bell badge) */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','EMPLOYEE')")
    @GetMapping("/unread-count")
    public Map<String, Long> getUnreadCount(Authentication auth) {
        return Map.of("count", notifRepo.countByEmpIdAndReadFalse(auth.getName()));
    }

    /** PUT /ems/notifications/{id}/read — mark one notification read */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','EMPLOYEE')")
    @PutMapping("/{id}/read")
    public ResponseEntity<Void> markRead(@PathVariable Long id, Authentication auth) {
        notifRepo.markAsRead(id, auth.getName());
        return ResponseEntity.ok().build();
    }

    /** PUT /ems/notifications/read-all — mark everything read (tap on bell) */
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','EMPLOYEE')")
    @PutMapping("/read-all")
    public ResponseEntity<Void> markAllRead(Authentication auth) {
        notifRepo.markAllAsRead(auth.getName());
        return ResponseEntity.ok().build();
    }

    private NotificationDTO toDTO(Notification n) {
        return NotificationDTO.builder()
                .id(n.getId())
                .empId(n.getEmpId())
                .title(n.getTitle())
                .body(n.getBody())
                .category(n.getCategory())
                .read(n.isRead())
                .relatedId(n.getRelatedId())
                .createdAt(n.getCreatedAt())
                .build();
    }
}
