package com.employee.servicesImpl;

import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

import com.employee.exceptions.EmailSendException;
import com.employee.services.EmailService;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class EmailServiceImpl implements EmailService {

    private final JavaMailSender       mailSender;
    private final SpringTemplateEngine templateEngine;

    @Override
    public void sendLoginDetails(String personalEmail, String empId,
                                  String companyEmail, String password, String name) {
        try {
            Context ctx = new Context();
            ctx.setVariable("empId", empId);
            ctx.setVariable("personalEmail", personalEmail);
            ctx.setVariable("companyEmail", companyEmail);
            ctx.setVariable("password", password);
            ctx.setVariable("name", name);

            String html = templateEngine.process("WelcomeEmailTemplate", ctx);
            MimeMessage msg = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(msg, MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED, "UTF-8");
            helper.setTo(personalEmail);
            helper.setSubject("Your Employee Login Details");
            helper.setText(html, true);
            helper.addInline("tektalisLogo", new ClassPathResource("email/Tektalis_Logo.png"), "image/png");
            mailSender.send(msg);
        } catch (Exception e) {
            throw new EmailSendException("Failed to send welcome email to: " + personalEmail, e);
        }
    }

    @Override
    public void sendResetPasswordEmail(String empId, String name, String companyEmail, String password) {
        try {
            Context ctx = new Context();
            ctx.setVariable("empId", empId);
            ctx.setVariable("companyEmail", companyEmail);
            ctx.setVariable("password", password);
            ctx.setVariable("name", name);

            String html = templateEngine.process("ResetPasswordEmailTemplate", ctx);
            MimeMessage msg = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(msg, MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED, "UTF-8");
            helper.setTo(companyEmail);
            helper.setSubject("Your Password Has Been Reset");
            helper.setText(html, true);
            helper.addInline("tektalisLogo", new ClassPathResource("email/Tektalis_Logo.png"), "image/png");
            mailSender.send(msg);
        } catch (Exception e) {
            throw new EmailSendException("Failed to send reset email to: " + companyEmail, e);
        }
    }
}
