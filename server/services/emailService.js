import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.initializeTransporter();
  }

  initializeTransporter() {
    const smtpConfig = {
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT) || 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD,
      },
    };

    if (!smtpConfig.auth.user || !smtpConfig.auth.pass) {
      console.warn(
        "⚠️ SMTP credentials not configured. Email alerts will be disabled."
      );
      this.isConfigured = false;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport(smtpConfig);
      this.isConfigured = true;
      console.log("✅ Email service configured successfully");
    } catch (error) {
      console.error("❌ Failed to initialize email transporter:", error);
      this.isConfigured = false;
    }
  }

  /**
   * Send PPE violation alert email with image attachment
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email address
   * @param {string} options.imageBuffer - Image buffer to attach
   * @param {Array} options.violations - Array of detected violations
   * @param {Date} options.timestamp - Timestamp of the violation
   */
  async sendViolationAlert({ to, imageBuffer, violations, timestamp }) {
    console.log(
      `📧 Email send attempt: configured=${
        this.isConfigured
      }, hasTransporter=${!!this
        .transporter}, hasImage=${!!imageBuffer}, imageSize=${
        imageBuffer ? imageBuffer.length : 0
      }`
    );

    if (!this.isConfigured || !this.transporter) {
      console.warn("⚠️ Email service not configured. Skipping email alert.");
      return { success: false, message: "Email service not configured" };
    }

    if (!imageBuffer) {
      console.warn("⚠️ No image buffer provided for email alert.");
    }

    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USERNAME;
    const recipientEmail = to || process.env.ALERT_RECIPIENT_EMAIL || fromEmail;

    // Create violation summary
    const violationList = violations
      .map((v) => `• ${v.replace(/-/g, " ").toUpperCase()}`)
      .join("\n");

    const mailOptions = {
      from: `PPE Detection System <${fromEmail}>`,
      to: recipientEmail,
      subject: `🚨 PPE Violation Alert - ${timestamp.toLocaleString()}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f8f9fa; }
            .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: white; padding: 20px; border: 1px solid #dee2e6; }
            .violations { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
            .footer { background-color: #e9ecef; padding: 15px; text-align: center; font-size: 12px; color: #6c757d; border-radius: 0 0 5px 5px; }
            .timestamp { color: #6c757d; font-size: 14px; }
            .image-container { text-align: center; margin: 20px 0; }
            .violation-image { max-width: 100%; height: auto; border: 2px solid #dc3545; border-radius: 5px; }
            .alert-badge { display: inline-block; background-color: #dc3545; color: white; padding: 5px 15px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚨 PPE Violation Detected</h1>
            </div>
            <div class="content">
              <p>Dear Safety Officer,</p>
              <p>A PPE (Personal Protective Equipment) violation has been detected in the monitored area.</p>
              
              <div class="violations">
                <h3>Detected Violations:</h3>
                <pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">${violationList}</pre>
              </div>

              <div class="image-container">
                ${
                  imageBuffer
                    ? `<img src="cid:violation_image" alt="PPE Violation Image" class="violation-image" />`
                    : '<p style="color: #999;">Image not available</p>'
                }
                <br/>
                <span class="alert-badge">🔴 URGENT ACTION REQUIRED</span>
              </div>

              <p class="timestamp"><strong>Detection Time:</strong> ${timestamp.toLocaleString()}</p>
              
              <p>Please review the image above and attached file for details and take appropriate action.</p>
              
              <p><strong>Action Required:</strong></p>
              <ul>
                <li>Immediately address the PPE violation</li>
                <li>Ensure proper PPE is worn before work continues</li>
                <li>Document the incident for safety records</li>
              </ul>
            </div>
            <div class="footer">
              <p>This is an automated alert from the PPE Detection System.</p>
              <p>Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
PPE Violation Alert

A PPE violation has been detected.

Detected Violations:
${violationList}

Detection Time: ${timestamp.toLocaleString()}

Please review the attached image for details and take appropriate action.

Action Required:
- Immediately address the PPE violation
- Ensure proper PPE is worn before work continues
- Document the incident for safety records

This is an automated alert from the PPE Detection System.
      `,
    };

    // Add attachment only if image buffer exists
    if (imageBuffer) {
      mailOptions.attachments = [
        {
          filename: `ppe_violation_${timestamp.getTime()}.jpg`,
          content: imageBuffer,
          cid: "violation_image",
        },
      ];
      console.log(
        `📎 Image attached to email (size: ${imageBuffer.length} bytes)`
      );
    } else {
      console.warn(`⚠️ No image buffer provided for email attachment`);
    }

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log("✅ Email alert sent successfully:", info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Failed to send email alert:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify email configuration
   */
  async verifyConfiguration() {
    if (!this.isConfigured || !this.transporter) {
      return { success: false, message: "Email service not configured" };
    }

    try {
      await this.transporter.verify();
      return { success: true, message: "Email configuration verified" };
    } catch (error) {
      console.error("❌ Email configuration verification failed:", error);
      return { success: false, error: error.message };
    }
  }
}

export default EmailService;
