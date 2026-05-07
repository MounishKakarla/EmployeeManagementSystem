"""Email service — mirrors EmailServiceImpl.java using smtplib / aiosmtplib with Jinja2 templates."""

import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging
from jinja2 import Environment, FileSystemLoader

from core.config import settings

logger = logging.getLogger(__name__)

# Setup Jinja2 template environment
templates_dir = os.path.join(os.path.dirname(__file__), '..', 'templates')
env = Environment(loader=FileSystemLoader(templates_dir))


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
    """Send welcome email with login details using WelcomeEmailTemplate."""
    try:
        template = env.get_template('WelcomeEmailTemplate.html')
        html_body = template.render(
            name=name,
            empId=emp_id,
            companyEmail=company_email,
            password=password
        )
        _send_email(personal_email, "Welcome to Tektalis - Your Account Has Been Created", html_body)
    except Exception as e:
        logger.error("Error rendering welcome email template: %s", e)
        raise


def send_reset_password_email(emp_id: str, name: str,
                               company_email: str, password: str) -> None:
    """Send password reset email using ResetPasswordEmailTemplate."""
    try:
        template = env.get_template('ResetPasswordEmailTemplate.html')
        html_body = template.render(
            name=name,
            empId=emp_id,
            password=password
        )
        _send_email(company_email, "Password Reset Request - Tektalis Employee Portal", html_body)
    except Exception as e:
        logger.error("Error rendering reset password email template: %s", e)
        raise
