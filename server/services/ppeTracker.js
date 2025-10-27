import { EmailService } from "./emailService.js";
import { ViolationStorageService } from "./violationStorageService.js";

export class PPETracker {
  constructor() {
    this.violations = new Map(); // Store violations per session
    this.lastViolationImage = new Map(); // Store last violation image
    this.emailTimers = new Map(); // Store email timer for each session
    this.alertInterval = 5 * 60 * 1000; // 5 minutes in milliseconds
    this.emailService = new EmailService();
    this.violationStorage = new ViolationStorageService();

    // Define PPE violation classes
    this.violationClasses = [
      "no-Helmet",
      "no-jacket",
      "no-mask",
      "no shoes",
      "no-safety-belt",
      "no-front-seftybelt",
    ];

    // Define proper PPE classes
    this.properPPEClasses = [
      "Helmet",
      "jacket",
      "mask",
      "shoes",
      "safety belt",
      "front-seftybelt",
    ];
  }

  /**
   * Normalize class name for matching
   * @param {string} className - Class name to normalize
   * @returns {string} Normalized class name
   */
  normalizeClassName(className) {
    if (!className) return "";

    // Normalize common variations
    return className
      .toLowerCase()
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/_/g, "-") // Replace underscores with hyphens
      .trim();
  }

  /**
   * Check if a class is a violation
   * @param {string} className - Class name to check
   * @returns {boolean} True if violation
   */
  isViolationClass(className) {
    const normalized = this.normalizeClassName(className);

    // Check exact matches
    for (const violationClass of this.violationClasses) {
      if (normalized === this.normalizeClassName(violationClass)) {
        return true;
      }
    }

    // Check for violation patterns
    return (
      normalized.includes("no-") ||
      normalized.includes("no_") ||
      normalized.includes("missing-") ||
      normalized.includes("missing_")
    );
  }

  /**
   * Check if a class is proper PPE
   * @param {string} className - Class name to check
   * @returns {boolean} True if proper PPE
   */
  isProperPPEClass(className) {
    const normalized = this.normalizeClassName(className);

    // Don't count if it's a violation
    if (this.isViolationClass(className)) {
      return false;
    }

    // Check exact matches
    for (const ppeClass of this.properPPEClasses) {
      if (normalized === this.normalizeClassName(ppeClass)) {
        return true;
      }
    }

    // Check for PPE keywords
    return (
      normalized.includes("helmet") ||
      normalized.includes("jacket") ||
      normalized.includes("mask") ||
      normalized.includes("shoe") ||
      normalized.includes("belt")
    );
  }

  /**
   * Check if detections contain PPE violations
   * @param {Array} detections - Array of detection objects
   * @returns {Object} Object containing violations and their details
   */
  checkViolations(detections) {
    const detectedViolations = [];
    const detectedPPE = [];

    if (!detections || detections.length === 0) {
      return {
        hasViolations: false,
        violations: [],
        ppe: [],
        isAllProperPPE: false,
      };
    }

    // Check each detection
    detections.forEach((detection) => {
      const className = detection.class || "";

      // Check if it's a violation with fuzzy matching
      if (this.isViolationClass(className)) {
        detectedViolations.push(className);
      }

      // Check if it's proper PPE
      if (this.isProperPPEClass(className)) {
        detectedPPE.push(className);
      }
    });

    // Determine if all required PPE is present
    // If we detect proper PPE classes and no violations, it's all good
    const hasViolations = detectedViolations.length > 0;
    const isAllProperPPE = detectedPPE.length > 0 && !hasViolations;

    return {
      hasViolations,
      violations: detectedViolations,
      ppe: detectedPPE,
      isAllProperPPE,
    };
  }

  /**
   * Register a detection session
   * @param {string} sessionId - Session identifier
   */
  registerSession(sessionId) {
    this.violations.set(sessionId, []);
    this.lastViolationImage.set(sessionId, null);
    console.log(`📋 PPE tracking started for session: ${sessionId}`);
  }

  /**
   * Process detection results and track violations
   * @param {string} sessionId - Session identifier
   * @param {Array} detections - Detection results
   * @param {Buffer} imageBuffer - Image buffer
   */
  async processDetection(sessionId, detections, imageBuffer) {
    const violationCheck = this.checkViolations(detections);

    if (violationCheck.hasViolations) {
      console.log(
        `⚠️ PPE violations detected in session ${sessionId}:`,
        violationCheck.violations
      );

      // Store violations
      this.violations.set(sessionId, violationCheck.violations);

      // Store last violation image
      if (imageBuffer) {
        this.lastViolationImage.set(sessionId, imageBuffer);
      }

      // Store violation in database (PDF will be generated every 15 minutes)
      try {
        const result = await this.violationStorage.storeViolation(
          detections,
          imageBuffer,
          "Live Detection"
        );
        console.log(
          `📋 Violation stored for session ${sessionId} - PDF will be generated`
        );
        console.log(`📊 Storage result:`, result);

        // Try to generate PDF immediately if there's a pending flag
        if (result && result.pendingPDFGeneration) {
          console.log(
            `🚀 Triggering immediate PDF generation for ${result.personId}`
          );
          // Use setImmediate to avoid blocking
          setImmediate(async () => {
            try {
              const generated =
                await this.violationStorage.generatePendingPDFs();
              if (generated && generated.length > 0) {
                console.log(
                  `✅ Successfully generated ${generated.length} PDF(s)`
                );
                generated.forEach((path) => console.log(`   - ${path}`));
              } else {
                console.log(`⚠️ No PDFs were generated`);
              }
            } catch (error) {
              console.error("Error generating PDF immediately:", error);
            }
          });
        } else {
          console.log(
            `⚠️ PDF generation NOT triggered - pendingPDFGeneration: ${result?.pendingPDFGeneration}`
          );
        }
      } catch (error) {
        console.error("Error storing violation:", error);
      }

      // Start or reset email alert timer if not already running
      this.startEmailAlertTimer(
        sessionId,
        violationCheck.violations,
        imageBuffer
      );
    } else if (violationCheck.isAllProperPPE) {
      console.log(`✅ All PPE properly worn in session ${sessionId}`);

      // Clear violations
      this.violations.set(sessionId, []);

      // Clear stored image
      this.lastViolationImage.set(sessionId, null);

      // Stop email alert timer
      this.stopEmailAlertTimer(sessionId);
    }
    // If neither violations nor proper PPE detected, do nothing (waiting for clearer detection)

    return violationCheck;
  }

  /**
   * Start email alert timer for a session
   * @param {string} sessionId - Session identifier
   * @param {Array} violations - Detected violations
   * @param {Buffer} imageBuffer - Image buffer
   */
  startEmailAlertTimer(sessionId, violations, imageBuffer) {
    // If timer already exists, don't create a new one
    if (this.emailTimers.has(sessionId)) {
      return;
    }

    console.log(
      `⏰ Starting email alert timer for session ${sessionId} (Service Not configured)`
    );

    // Send initial alert immediately
    this.sendViolationEmail(sessionId, violations, imageBuffer);

    // Set up recurring alerts every 5 minutes
    const timer = setInterval(() => {
      const currentViolations = this.violations.get(sessionId);
      const currentImage = this.lastViolationImage.get(sessionId);

      if (currentViolations && currentViolations.length > 0) {
        console.log(
          `📧 Sending recurring email alert for session ${sessionId}`
        );
        this.sendViolationEmail(sessionId, currentViolations, currentImage);
      } else {
        // No more violations, stop the timer
        console.log(
          `✅ No violations detected, stopping email timer for session ${sessionId}`
        );
        this.stopEmailAlertTimer(sessionId);
      }
    }, this.alertInterval);

    this.emailTimers.set(sessionId, timer);
  }

  /**
   * Stop email alert timer for a session
   * @param {string} sessionId - Session identifier
   */
  stopEmailAlertTimer(sessionId) {
    const timer = this.emailTimers.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.emailTimers.delete(sessionId);
      console.log(`🛑 Email alert timer stopped for session ${sessionId}`);
    }
  }

  /**
   * Send violation email
   * @param {string} sessionId - Session identifier
   * @param {Array} violations - Detected violations
   * @param {Buffer} imageBuffer - Image buffer
   */
  async sendViolationEmail(sessionId, violations, imageBuffer) {
    if (!violations || violations.length === 0) {
      return;
    }

    const timestamp = new Date();

    console.log(`📧 Preparing to send email alert for session ${sessionId}`);
    console.log(`   Violations: ${violations.join(", ")}`);
    console.log(
      `   ImageBuffer: ${
        imageBuffer ? `Yes (${imageBuffer.length} bytes)` : "NO IMAGE"
      }`
    );

    try {
      const result = await this.emailService.sendViolationAlert({
        imageBuffer: imageBuffer,
        violations: violations,
        timestamp: timestamp,
      });

      if (result.success) {
        console.log(
          `✅ Email alert sent successfully for session ${sessionId}`
        );
      } else {
        console.error(
          `❌ Failed to send email alert for session ${sessionId}:`,
          result.message
        );
      }
    } catch (error) {
      console.error(
        `❌ Error sending email alert for session ${sessionId}:`,
        error
      );
    }
  }

  /**
   * Unregister a detection session
   * @param {string} sessionId - Session identifier
   */
  unregisterSession(sessionId) {
    this.stopEmailAlertTimer(sessionId);
    this.violations.delete(sessionId);
    this.lastViolationImage.delete(sessionId);
    console.log(`🧹 PPE tracking cleaned up for session: ${sessionId}`);
  }

  /**
   * Get current violations for a session
   * @param {string} sessionId - Session identifier
   * @returns {Array} Array of violations
   */
  getViolations(sessionId) {
    return this.violations.get(sessionId) || [];
  }

  /**
   * Get statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      activeSessions: this.violations.size,
      sessionsWithTimers: this.emailTimers.size,
      totalViolations: Array.from(this.violations.values()).reduce(
        (sum, violations) => sum + violations.length,
        0
      ),
    };
  }
}

export default PPETracker;
