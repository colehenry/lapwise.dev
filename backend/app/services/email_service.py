"""
Email Service

Transactional email sending via Resend.
"""

import logging

import resend

from app.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    @staticmethod
    def _send(to: str, subject: str, html: str) -> None:
        if not settings.resend_api_key:
            logger.warning("RESEND_API_KEY not set — skipping email to %s", to)
            return

        resend.api_key = settings.resend_api_key
        try:
            resend.Emails.send(
                {
                    "from": settings.email_from,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                }
            )
        except Exception:
            logger.exception("Failed to send email to %s", to)

    @staticmethod
    def send_verification_email(email: str, username: str, token: str) -> None:
        url = f"{settings.frontend_url}/verify-email?token={token}"
        html = f"""
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #a855f7;">Welcome to lapwise.dev</h2>
            <p>Hi <strong>{username}</strong>,</p>
            <p>Thanks for signing up! Please verify your email address:</p>
            <p>
                <a href="{url}"
                   style="display: inline-block; padding: 12px 24px;
                          background: #a855f7; color: #fff; text-decoration: none;
                          border-radius: 6px; font-weight: 600;">
                    Verify Email
                </a>
            </p>
            <p style="color: #888; font-size: 13px;">
                This link expires in 24 hours.
                If you didn't create this account, you can ignore this email.
            </p>
        </div>
        """
        EmailService._send(email, "Verify your lapwise.dev email", html)

    @staticmethod
    def send_password_reset_email(email: str, username: str, token: str) -> None:
        url = f"{settings.frontend_url}/reset-password?token={token}"
        html = f"""
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #a855f7;">Password Reset</h2>
            <p>Hi <strong>{username}</strong>,</p>
            <p>We received a password reset request for your account:</p>
            <p>
                <a href="{url}"
                   style="display: inline-block; padding: 12px 24px;
                          background: #a855f7; color: #fff; text-decoration: none;
                          border-radius: 6px; font-weight: 600;">
                    Reset Password
                </a>
            </p>
            <p style="color: #888; font-size: 13px;">
                This link expires in 1 hour.
                If you didn't request this, you can safely ignore it.
            </p>
        </div>
        """
        EmailService._send(email, "Reset your lapwise.dev password", html)

    @staticmethod
    def send_password_changed_notification(email: str, username: str) -> None:
        html = f"""
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #a855f7;">Password Changed</h2>
            <p>Hi <strong>{username}</strong>,</p>
            <p>Your lapwise.dev password was successfully changed.</p>
            <p style="color: #888; font-size: 13px;">
                If you didn't make this change, please reset your password
                immediately or contact support.
            </p>
        </div>
        """
        EmailService._send(email, "Your lapwise.dev password was changed", html)
