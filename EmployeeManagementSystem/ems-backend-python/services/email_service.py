"""Email service — mirrors EmailServiceImpl.java using smtplib / aiosmtplib."""

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging

from core.config import settings

logger = logging.getLogger(__name__)


def _send_email(to: str, subject: str, html_body: str) -> None:
    """Send email via Gmail SMTP (synchronous — runs in thread pool)."""
    try:
        msg = MIMEMultipart("related")
        msg["Subject"] = subject
        msg["From"] = settings.mail_username
        msg["To"] = to
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        with smtplib.SMTP(settings.mail_host, settings.mail_port) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.mail_username, settings.mail_password)
            server.sendmail(settings.mail_username, to, msg.as_string())

        logger.info("Email sent to %s — %s", to, subject)
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to, e)
        raise


def send_login_details(personal_email: str, emp_id: str,
                       company_email: str, password: str, name: str) -> None:
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Welcome to Tektalis, {name}!</h2>
        <p>Your employee account has been created. Here are your login details:</p>
        <table style="border-collapse: collapse;">
            <tr><td style="padding: 8px; font-weight: bold;">Employee ID:</td><td style="padding: 8px;">{emp_id}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Company Email:</td><td style="padding: 8px;">{company_email}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Password:</td><td style="padding: 8px;">{password}</td></tr>
        </table>
        <p style="margin-top: 16px;">Please change your password after your first login.</p>
        <p>Best regards,<br/>HR Team</p>
    </body>
    </html>
    """
    _send_email(personal_email, "Your Employee Login Details", html)


def send_reset_password_email(emp_id: str, name: str,
                               company_email: str, password: str) -> None:
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Password Reset — {name}</h2>
        <p>Your password has been reset by an administrator.</p>
        <table style="border-collapse: collapse;">
            <tr><td style="padding: 8px; font-weight: bold;">Employee ID:</td><td style="padding: 8px;">{emp_id}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">New Password:</td><td style="padding: 8px;">{password}</td></tr>
        </table>
        <p style="margin-top: 16px;">Please change your password immediately after logging in.</p>
        <p>Best regards,<br/>HR Team</p>
    </body>
    </html>
    """
    _send_email(company_email, "Your Password Has Been Reset", html)
