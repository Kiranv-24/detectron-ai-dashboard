import { PDFReportService } from "./pdfReportService.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ViolationStorageService {
  constructor() {
    this.storageFile = path.join(__dirname, "../data/violations.json");
    this.pdfService = new PDFReportService();
    this.ensureStorageDirectory();
    // Start fresh - don't load old cached violations
    this.violations = {};
    console.log("🔄 Starting with fresh violation storage (no cached data)");
  }

  ensureStorageDirectory() {
    const dataDir = path.join(__dirname, "../data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  /**
   * Load violations from storage
   * @returns {Object} - Violations data
   */
  loadViolations() {
    try {
      if (fs.existsSync(this.storageFile)) {
        const data = fs.readFileSync(this.storageFile, "utf8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Error loading violations:", error);
    }
    return {};
  }

  /**
   * Save violations to storage
   */
  saveViolations() {
    try {
      fs.writeFileSync(
        this.storageFile,
        JSON.stringify(this.violations, null, 2)
      );
    } catch (error) {
      console.error("Error saving violations:", error);
    }
  }

  /**
   * Generate unique person ID based on detection characteristics
   * @param {Array} detections - Detection results
   * @returns {string} - Unique person identifier
   */
  generatePersonId(detections) {
    // Simple person identification based on detection patterns
    // In a real system, you'd use more sophisticated person tracking
    const personDetections = detections.filter((d) => d.class === "person");

    if (personDetections.length > 0) {
      const person = personDetections[0];
      // Create ID based on position and size (simplified approach)
      const positionHash =
        Math.round(person.x * 100) + Math.round(person.y * 100);
      const sizeHash =
        Math.round(person.width * 100) + Math.round(person.height * 100);
      return `person_${positionHash}_${sizeHash}`;
    }

    // Fallback to timestamp-based ID
    return `person_${Date.now()}`;
  }

  /**
   * Store violation and generate/update PDF report
   * @param {Array} detections - Detection results
   * @param {Buffer} imageBuffer - Image buffer
   * @param {string} location - Location of violation
   * @returns {Promise<Object>} - Storage result
   */
  async storeViolation(detections, imageBuffer, location = "Unknown Location") {
    const personId = this.generatePersonId(detections);
    const timestamp = new Date().toISOString();

    // Extract violations
    const violations = detections
      .filter((d) => this.isViolation(d.class))
      .map((d) => d.class);

    if (violations.length === 0) {
      return { success: false, message: "No violations detected" };
    }

    // Check if this person already has violations
    if (!this.violations[personId]) {
      this.violations[personId] = {
        personId,
        firstSeen: timestamp,
        lastSeen: timestamp,
        totalViolations: 0,
        violations: [],
        reports: [],
        pendingPDFGeneration: true, // Set to true for new person
        violationsPDFGenerated: 0, // Track that no PDFs generated yet
      };
    }

    // Update person data
    const personData = this.violations[personId];
    personData.lastSeen = timestamp;
    personData.totalViolations += violations.length;

    // Add new violation record
    const violationRecord = {
      id: `${personId}_${Date.now()}`,
      timestamp,
      violations,
      location,
      imageBase64: imageBuffer ? imageBuffer.toString("base64") : null,
    };

    personData.violations.push(violationRecord);

    // Mark for PDF generation - always set to true when violations are added
    // The timer will check if PDF needs to be regenerated based on violation count
    const hasNewViolations =
      personData.violationsPDFGenerated === undefined ||
      personData.violations.length > personData.violationsPDFGenerated;

    if (hasNewViolations) {
      personData.pendingPDFGeneration = true;
      console.log(`🔄 New violations detected - Marking for PDF generation`);
      console.log(
        `   Previous PDF had ${
          personData.violationsPDFGenerated || 0
        } violations, now have ${personData.violations.length}`
      );
    } else {
      console.log(
        `   No new violations - keeping pendingPDFGeneration as ${personData.pendingPDFGeneration}`
      );
    }

    // Save to storage
    this.saveViolations();

    console.log(`📋 Violation stored for person ${personId}:`, violations);
    console.log(
      `⏰ PDF will be generated every 15 minutes for person ${personId}`
    );

    return {
      success: true,
      personId,
      violations,
      timestamp,
      totalViolations: personData.totalViolations,
      pendingPDFGeneration: true,
    };
  }

  /**
   * Normalize class name for matching
   * @param {string} className - Class name to normalize
   * @returns {string} Normalized class name
   */
  normalizeClassName(className) {
    if (!className) return "";
    return className
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/_/g, "-")
      .trim();
  }

  /**
   * Check if a detection class is a violation
   * @param {string} className - Detection class name
   * @returns {boolean} - Is violation
   */
  isViolation(className) {
    if (!className) return false;

    const normalized = this.normalizeClassName(className);
    const violationClasses = [
      "no-helmet",
      "no-jacket",
      "no-mask",
      "no-shoes",
      "no-safety-belt",
      "no-front-safetybelt",
      "no-safety-belt",
    ];

    // Check exact matches
    if (violationClasses.includes(normalized)) {
      return true;
    }

    // Check for violation patterns
    return normalized.includes("no-") || normalized.includes("missing-");
  }

  /**
   * Get all violations
   * @returns {Object} - All violations data
   */
  getAllViolations() {
    return this.violations;
  }

  /**
   * Get violations for a specific person
   * @param {string} personId - Person identifier
   * @returns {Object|null} - Person violations or null
   */
  getPersonViolations(personId) {
    return this.violations[personId] || null;
  }

  /**
   * Get violation statistics
   * @returns {Object} - Statistics
   */
  getStatistics() {
    const persons = Object.values(this.violations);
    const totalPersons = persons.length;
    const totalViolations = persons.reduce(
      (sum, person) => sum + person.totalViolations,
      0
    );
    const totalReports = persons.reduce(
      (sum, person) => sum + person.reports.length,
      0
    );

    return {
      totalPersons,
      totalViolations,
      totalReports,
      averageViolationsPerPerson:
        totalPersons > 0 ? totalViolations / totalPersons : 0,
    };
  }

  /**
   * Get recent violations
   * @param {number} limit - Number of recent violations to return
   * @returns {Array} - Recent violations
   */
  getRecentViolations(limit = 10) {
    const allViolations = [];

    Object.values(this.violations).forEach((person) => {
      person.violations.forEach((violation) => {
        allViolations.push({
          personId: person.personId,
          ...violation,
        });
      });
    });

    return allViolations
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Generate PDFs for all persons with pending violations
   * @returns {Promise<Array>} - Array of generated PDF paths
   */
  async generatePendingPDFs() {
    const generatedPDFs = [];

    console.log(
      `🔍 Checking PDF generation - ${
        Object.keys(this.violations).length
      } persons in database`
    );

    for (const [personId, personData] of Object.entries(this.violations)) {
      // Check if there are violations and if PDF needs to be generated
      const hasNewViolations =
        personData.violationsPDFGenerated === undefined ||
        personData.violations.length > personData.violationsPDFGenerated;

      console.log(
        `   Person ${personId}: violations=${personData.violations.length}, ` +
          `pending=${personData.pendingPDFGeneration}, ` +
          `pdfGenerated=${personData.violationsPDFGenerated || 0}, ` +
          `hasNew=${hasNewViolations}`
      );

      if (
        personData.violations.length > 0 &&
        (personData.pendingPDFGeneration || hasNewViolations)
      ) {
        try {
          console.log(
            `📄 Generating PDF for person ${personId} with ${personData.violations.length} violations`
          );
          console.log(
            `   Conditions: violations=${personData.violations.length} > 0, pending=${personData.pendingPDFGeneration}, hasNew=${hasNewViolations}`
          );

          // Get all unique violations for this person
          const allViolations = [
            ...new Set(personData.violations.flatMap((v) => v.violations)),
          ];

          // Get the MOST RECENT violation image - sort by timestamp to ensure we get the latest
          const sortedViolations = [...personData.violations].sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
          );

          const recentViolation = sortedViolations[0];
          const imageBuffer = recentViolation.imageBase64
            ? Buffer.from(recentViolation.imageBase64, "base64")
            : null;

          console.log(
            `📷 Using image from most recent violation at ${recentViolation.timestamp}`
          );

          console.log(
            `   Image buffer available: ${
              imageBuffer ? "YES (" + imageBuffer.length + " bytes)" : "NO"
            }`
          );

          if (!imageBuffer) {
            console.error(
              `   ❌ No image buffer available for person ${personId}`
            );
            continue; // Skip if no image
          }

          // Generate comprehensive PDF with all violations (this will create a new PDF each time)
          const pdfPath =
            await this.pdfService.generateComprehensiveViolationReport({
              personId,
              violations: allViolations,
              violationHistory: personData.violations,
              firstSeen: personData.firstSeen,
              lastSeen: personData.lastSeen,
              totalViolations: personData.totalViolations,
              imageBuffer,
              location: recentViolation.location,
            });

          // Store report info with timestamp for this specific PDF
          const reportInfo = {
            id: `${personId}_${Date.now()}`,
            timestamp: new Date().toISOString(),
            pdfPath,
            violations: allViolations,
            totalViolations: personData.totalViolations,
            lastSeenImageTimestamp: recentViolation.timestamp,
          };

          personData.reports.push(reportInfo);

          // Mark as processed for this batch
          personData.pendingPDFGeneration = false;

          // Keep track of violations that have been PDF'd - use timestamp to track what's been included
          personData.lastPDFGenerationTime = new Date().toISOString();
          personData.violationsPDFGenerated = personData.violations.length;

          generatedPDFs.push(pdfPath);
          console.log(`✅ PDF generated for person ${personId}: ${pdfPath}`);
          console.log(
            `   Including ${personData.violations.length} violation records`
          );
        } catch (error) {
          console.error(
            `❌ Error generating PDF for person ${personId}:`,
            error
          );
        }
      } else {
        console.log(
          `   ⏭️ Skipping PDF generation for ${personId} - conditions not met`
        );
        console.log(
          `     violations.length=${personData.violations.length}, pending=${personData.pendingPDFGeneration}, hasNew=${hasNewViolations}`
        );
      }
    }

    // Save updated data
    this.saveViolations();

    return generatedPDFs;
  }

  /**
   * Start the PDF generation timer (DISABLED - using immediate generation instead)
   */
  startPDFGenerationTimer() {
    console.log("⏰ PDF generation is set to IMMEDIATE mode (no timer)");

    // Generate PDFs immediately for any pending violations on startup
    console.log("📄 Checking for pending PDFs to generate immediately...");
    this.generatePendingPDFs();

    // DISABLED: Don't use timer, generate immediately on violation detection instead
    // Timer disabled to avoid caching old data - PDFs generated immediately when violations occur
    /*
    setInterval(async () => {
      console.log("⏰ Running scheduled PDF generation (every 1 minute)");
      console.log(
        `📊 Total persons in violations database: ${
          Object.keys(this.violations).length
        }`
      );

      for (const [personId, personData] of Object.entries(this.violations)) {
        console.log(
          `   Person ${personId}: pending=${
            personData.pendingPDFGeneration
          }, violations=${personData.violations.length}, pdfGenerated=${
            personData.violationsPDFGenerated || 0
          }`
        );
      }

      const generatedPDFs = await this.generatePendingPDFs();
      if (generatedPDFs.length > 0) {
        console.log(`📄 Generated ${generatedPDFs.length} PDF reports`);
        generatedPDFs.forEach((path, idx) => {
          console.log(`   ${idx + 1}. ${path}`);
        });
      } else {
        console.log("📄 No pending PDFs to generate");
      }
    }, 1 * 60 * 1000); // DISABLED - using immediate generation instead
    */

    console.log("✅ PDF generation uses IMMEDIATE mode (no timer)");
  }
}

export default ViolationStorageService;
