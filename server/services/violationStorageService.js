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
    this.violations = {};
    console.log("🔄 Starting with fresh violation storage (no cached data)");
  }

  ensureStorageDirectory() {
    const dataDir = path.join(__dirname, "../data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

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

  generatePersonId(detections) {
    const personDetections = detections.filter((d) => d.class === "person");

    if (personDetections.length > 0) {
      const person = personDetections[0];
      const positionHash =
        Math.round(person.x * 100) + Math.round(person.y * 100);
      const sizeHash =
        Math.round(person.width * 100) + Math.round(person.height * 100);
      return `person_${positionHash}_${sizeHash}`;
    }

    return `person_${Date.now()}`;
  }

  async storeViolation(detections, imageBuffer, location = "Unknown Location") {
    const personId = this.generatePersonId(detections);
    const timestamp = new Date().toISOString();

    const violations = detections
      .filter((d) => this.isViolation(d.class))
      .map((d) => d.class);

    if (violations.length === 0) {
      return { success: false, message: "No violations detected" };
    }

    if (!this.violations[personId]) {
      this.violations[personId] = {
        personId,
        firstSeen: timestamp,
        lastSeen: timestamp,
        totalViolations: 0,
        violations: [],
        reports: [],
        pendingPDFGeneration: true,
        violationsPDFGenerated: 0,
      };
    }

    const personData = this.violations[personId];
    personData.lastSeen = timestamp;
    personData.totalViolations += violations.length;

    const violationRecord = {
      id: `${personId}_${Date.now()}`,
      timestamp,
      violations,
      location,
      imageBase64: imageBuffer ? imageBuffer.toString("base64") : null,
    };

    personData.violations.push(violationRecord);
    personData.pendingPDFGeneration = true;

    this.saveViolations();

    console.log(`📋 Violation stored for person ${personId}:`, violations);
    console.log(`⚡ Generating PDF immediately for live detection...`);

    try {
      const allViolations = [
        ...new Set(personData.violations.flatMap((v) => v.violations)),
      ];

      const sortedViolations = [...personData.violations].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );

      const recentViolation = sortedViolations[0];
      const imageBufferLive = recentViolation.imageBase64
        ? Buffer.from(recentViolation.imageBase64, "base64")
        : null;

      if (imageBufferLive) {
        const pdfPath =
          await this.pdfService.generateComprehensiveViolationReport({
            personId,
            violations: allViolations,
            violationHistory: personData.violations,
            firstSeen: personData.firstSeen,
            lastSeen: personData.lastSeen,
            totalViolations: personData.totalViolations,
            imageBuffer: imageBufferLive,
            location: recentViolation.location,
          });

        const reportInfo = {
          id: `${personId}_${Date.now()}`,
          timestamp: new Date().toISOString(),
          pdfPath,
          violations: allViolations,
          totalViolations: personData.totalViolations,
          lastSeenImageTimestamp: recentViolation.timestamp,
        };

        personData.reports.push(reportInfo);
        personData.pendingPDFGeneration = false;
        personData.lastPDFGenerationTime = new Date().toISOString();
        personData.violationsPDFGenerated = personData.violations.length;

        this.saveViolations();
        console.log(`✅ Live PDF generated for person ${personId}: ${pdfPath}`);
      } else {
        console.warn(`⚠️ No image found for live detection PDF of ${personId}`);
      }
    } catch (err) {
      console.error(`❌ Failed to generate live PDF for ${personId}:`, err);
    }

    return {
      success: true,
      personId,
      violations,
      timestamp,
      totalViolations: personData.totalViolations,
      pdfGenerated: true,
    };
  }

  normalizeClassName(className) {
    if (!className) return "";
    return className
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/_/g, "-")
      .trim();
  }

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

    if (violationClasses.includes(normalized)) {
      return true;
    }

    return normalized.includes("no-") || normalized.includes("missing-");
  }

  getAllViolations() {
    return this.violations;
  }

  getPersonViolations(personId) {
    return this.violations[personId] || null;
  }

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

  async generatePendingPDFs() {
    const generatedPDFs = [];
    console.log(
      `🔍 Checking PDF generation - ${
        Object.keys(this.violations).length
      } persons in database`
    );

    for (const [personId, personData] of Object.entries(this.violations)) {
      const hasNewViolations =
        personData.violationsPDFGenerated === undefined ||
        personData.violations.length > personData.violationsPDFGenerated;

      if (
        personData.violations.length > 0 &&
        (personData.pendingPDFGeneration || hasNewViolations)
      ) {
        try {
          const allViolations = [
            ...new Set(personData.violations.flatMap((v) => v.violations)),
          ];

          const sortedViolations = [...personData.violations].sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
          );

          const recentViolation = sortedViolations[0];
          const imageBuffer = recentViolation.imageBase64
            ? Buffer.from(recentViolation.imageBase64, "base64")
            : null;

          if (!imageBuffer) continue;

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

          const reportInfo = {
            id: `${personId}_${Date.now()}`,
            timestamp: new Date().toISOString(),
            pdfPath,
            violations: allViolations,
            totalViolations: personData.totalViolations,
            lastSeenImageTimestamp: recentViolation.timestamp,
          };

          personData.reports.push(reportInfo);
          personData.pendingPDFGeneration = false;
          personData.lastPDFGenerationTime = new Date().toISOString();
          personData.violationsPDFGenerated = personData.violations.length;

          generatedPDFs.push(pdfPath);
          console.log(`✅ PDF generated for ${personId}: ${pdfPath}`);
        } catch (error) {
          console.error(`❌ Error generating PDF for ${personId}:`, error);
        }
      }
    }

    this.saveViolations();
    return generatedPDFs;
  }

  startPDFGenerationTimer() {
    console.log("⏰ PDF generation is set to IMMEDIATE mode (no timer)");
    this.generatePendingPDFs();
    console.log("✅ PDF generation uses IMMEDIATE mode (no timer)");
  }
}

export const violationStorage = new ViolationStorageService();
export default ViolationStorageService;
