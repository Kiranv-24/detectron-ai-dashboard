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
    this.violations = this.loadViolations();
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
        const data = fs.readFileSync(this.storageFile, 'utf8');
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
      fs.writeFileSync(this.storageFile, JSON.stringify(this.violations, null, 2));
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
    const personDetections = detections.filter(d => d.class === 'person');
    
    if (personDetections.length > 0) {
      const person = personDetections[0];
      // Create ID based on position and size (simplified approach)
      const positionHash = Math.round(person.x * 100) + Math.round(person.y * 100);
      const sizeHash = Math.round(person.width * 100) + Math.round(person.height * 100);
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
      .filter(d => this.isViolation(d.class))
      .map(d => d.class);

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
        reports: []
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
      imageBase64: imageBuffer ? imageBuffer.toString('base64') : null
    };

    personData.violations.push(violationRecord);

    // Generate or update PDF report
    try {
      const pdfPath = await this.pdfService.updatePersonViolationReport(personId, {
        violation: violations[0], // Use first violation for simplicity
        timestamp,
        imageBuffer,
        location
      });

      // Store report info
      const reportInfo = {
        id: `${personId}_${Date.now()}`,
        timestamp,
        pdfPath,
        violations
      };

      personData.reports.push(reportInfo);

      // Save to storage
      this.saveViolations();

      console.log(`📋 Violation stored for person ${personId}:`, violations);

      return {
        success: true,
        personId,
        violations,
        timestamp,
        pdfPath,
        totalViolations: personData.totalViolations
      };
    } catch (error) {
      console.error("Error generating PDF report:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if a detection class is a violation
   * @param {string} className - Detection class name
   * @returns {boolean} - Is violation
   */
  isViolation(className) {
    const violationClasses = [
      "no-Helmet",
      "no-jacket", 
      "no-mask",
      "no shoes",
      "no-safety-belt",
      "no-front-seftybelt"
    ];
    return violationClasses.includes(className);
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
    const totalViolations = persons.reduce((sum, person) => sum + person.totalViolations, 0);
    const totalReports = persons.reduce((sum, person) => sum + person.reports.length, 0);

    return {
      totalPersons,
      totalViolations,
      totalReports,
      averageViolationsPerPerson: totalPersons > 0 ? totalViolations / totalPersons : 0
    };
  }

  /**
   * Get recent violations
   * @param {number} limit - Number of recent violations to return
   * @returns {Array} - Recent violations
   */
  getRecentViolations(limit = 10) {
    const allViolations = [];
    
    Object.values(this.violations).forEach(person => {
      person.violations.forEach(violation => {
        allViolations.push({
          personId: person.personId,
          ...violation
        });
      });
    });

    return allViolations
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Clear all violations (for testing/reset)
   */
  clearAllViolations() {
    this.violations = {};
    this.saveViolations();
    console.log("🧹 All violations cleared");
  }
}

export default ViolationStorageService;
