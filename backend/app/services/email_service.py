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
        <div style="background-color: #0a0a0f; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e7e7e9;">
            <div style="max-width: 480px; margin: 0 auto; background-color: #15151e; border-radius: 12px; border: 1px solid #2a2a35; overflow: hidden;">
                <div style="padding: 32px; text-align: center;">
                    <div style="margin-bottom: 32px;">
                        <span style="font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.025em; font-family: sans-serif;">
                            lapwise<span style="color: #a020f0;">.dev</span>
                        </span>
                    </div>
                    
                    <h2 style="color: #ffffff; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 16px;">Verify your email</h2>
                    <p style="margin-bottom: 24px; line-height: 1.6; color: #e7e7e9;">Hi <strong>{username}</strong>,</p>
                    <p style="margin-bottom: 32px; line-height: 1.6; color: #999999;">Thanks for signing up for lapwise.dev! Please verify your email address to get started.</p>
                    
                    <a href="{url}"
                       style="display: inline-block; padding: 12px 32px;
                              background-color: #a020f0; color: #ffffff; text-decoration: none;
                              border-radius: 8px; font-weight: 600; font-size: 16px;">
                        Verify Email
                    </a>
                    
                    <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #2a2a35; text-align: left;">
                        <p style="color: #666666; font-size: 13px; margin-bottom: 8px;">
                            This link expires in 24 hours.
                        </p>
                        <p style="color: #666666; font-size: 13px; margin: 0;">
                            If you didn't create this account, you can safely ignore this email.
                        </p>
                    </div>
                </div>
            </div>
            <div style="max-width: 480px; margin: 24px auto 0; text-align: center;">
                <p style="color: #666666; font-size: 12px; margin: 0;">
                    &copy; 2026 lapwise.dev
                </p>
            </div>
        </div>
        """
        EmailService._send(email, "Verify your lapwise.dev email", html)

    @staticmethod
    def send_password_reset_email(email: str, username: str, token: str) -> None:
        url = f"{settings.frontend_url}/reset-password?token={token}"
        html = f"""
        <div style="background-color: #0a0a0f; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e7e7e9;">
            <div style="max-width: 480px; margin: 0 auto; background-color: #15151e; border-radius: 12px; border: 1px solid #2a2a35; overflow: hidden;">
                <div style="padding: 32px; text-align: center;">
                    <div style="margin-bottom: 32px;">
                        <span style="font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.025em; font-family: sans-serif;">
                            lapwise<span style="color: #a020f0;">.dev</span>
                        </span>
                    </div>
                    
                    <h2 style="color: #ffffff; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 16px;">Reset your password</h2>
                    <p style="margin-bottom: 24px; line-height: 1.6; color: #e7e7e9;">Hi <strong>{username}</strong>,</p>
                    <p style="margin-bottom: 32px; line-height: 1.6; color: #999999;">We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>
                    
                    <a href="{url}"
                       style="display: inline-block; padding: 12px 32px;
                              background-color: #a020f0; color: #ffffff; text-decoration: none;
                              border-radius: 8px; font-weight: 600; font-size: 16px;">
                        Reset Password
                    </a>
                    
                    <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #2a2a35; text-align: left;">
                        <p style="color: #666666; font-size: 13px; margin-bottom: 8px;">
                            This link expires in 1 hour.
                        </p>
                    </div>
                </div>
            </div>
            <div style="max-width: 480px; margin: 24px auto 0; text-align: center;">
                <p style="color: #666666; font-size: 12px; margin: 0;">
                    &copy; 2026 lapwise.dev
                </p>
            </div>
        </div>
        """
        EmailService._send(email, "Reset your lapwise.dev password", html)

    @staticmethod
    def send_password_changed_notification(email: str, username: str) -> None:
        html = f"""
        <div style="background-color: #0a0a0f; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e7e7e9;">
            <div style="max-width: 480px; margin: 0 auto; background-color: #15151e; border-radius: 12px; border: 1px solid #2a2a35; overflow: hidden;">
                <div style="padding: 32px; text-align: center;">
                    <div style="margin-bottom: 32px;">
                        <span style="font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.025em; font-family: sans-serif;">
                            lapwise<span style="color: #a020f0;">.dev</span>
                        </span>
                    </div>
                    
                    <h2 style="color: #ffffff; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 16px;">Password Changed</h2>
                    <p style="margin-bottom: 24px; line-height: 1.6; color: #e7e7e9;">Hi <strong>{username}</strong>,</p>
                    <p style="margin-bottom: 32px; line-height: 1.6; color: #999999;">Your lapwise.dev password was successfully changed.</p>
                    
                    <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #2a2a35; text-align: left;">
                        <p style="color: #666666; font-size: 13px; margin: 0;">
                            If you didn't make this change, please reset your password immediately or contact support.
                        </p>
                    </div>
                </div>
            </div>
            <div style="max-width: 480px; margin: 24px auto 0; text-align: center;">
                <p style="color: #666666; font-size: 12px; margin: 0;">
                    &copy; 2026 lapwise.dev
                </p>
            </div>
        </div>
        """
        EmailService._send(email, "Your lapwise.dev password was changed", html)
