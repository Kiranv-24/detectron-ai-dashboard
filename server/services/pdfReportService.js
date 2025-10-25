import { jsPDF } from "jspdf";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PDFReportService {
  constructor() {
    this.reportsDir = path.join(__dirname, "../reports");
    this.ensureReportsDirectory();
  }

  ensureReportsDirectory() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Generate PDF report for PPE violations
   * @param {Object} violationData - Violation data
   * @param {string} violationData.personId - Unique person identifier
   * @param {Array} violationData.violations - Array of violations
   * @param {string} violationData.timestamp - Violation timestamp
   * @param {Buffer} violationData.imageBuffer - Image buffer
   * @param {string} violationData.location - Location of violation
   * @returns {Promise<string>} - Path to generated PDF
   */
  async generateViolationReport(violationData) {
    const {
      personId,
      violations,
      timestamp,
      imageBuffer,
      location = "Unknown Location",
    } = violationData;

    // Create PDF document
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;

    let yPosition = margin;

    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("PPE Violation Report", pageWidth / 2, yPosition, {
      align: "center",
    });
    yPosition += 15;

    // Report ID and Date
    const reportId = uuidv4().substring(0, 8).toUpperCase();
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Report ID: ${reportId}`, margin, yPosition);
    doc.text(
      `Generated: ${new Date().toLocaleString()}`,
      pageWidth - margin,
      yPosition,
      { align: "right" }
    );
    yPosition += 10;

    // Person ID
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Person ID: ${personId}`, margin, yPosition);
    yPosition += 8;

    // Location
    doc.setFont("helvetica", "normal");
    doc.text(`Location: ${location}`, margin, yPosition);
    yPosition += 8;

    // Violation Details
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Violation Details", margin, yPosition);
    yPosition += 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");

    violations.forEach((violation, index) => {
      const violationText = violation.replace(/-/g, " ").toUpperCase();
      doc.text(`${index + 1}. ${violationText}`, margin + 10, yPosition);
      yPosition += 6;
    });

    yPosition += 10;

    // Violation Timestamp
    doc.setFont("helvetica", "bold");
    doc.text(
      `Violation Detected: ${new Date(timestamp).toLocaleString()}`,
      margin,
      yPosition
    );
    yPosition += 15;

    // Add image if available
    if (imageBuffer) {
      try {
        // Convert buffer to base64
        const base64Image = imageBuffer.toString("base64");
        const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;

        // Add image to PDF
        const imgWidth = contentWidth * 0.8;
        const imgHeight = (imgWidth * 3) / 4; // 4:3 aspect ratio

        // Check if image fits on current page
        if (yPosition + imgHeight > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }

        doc.addImage(
          imageDataUrl,
          "JPEG",
          margin + (contentWidth - imgWidth) / 2,
          yPosition,
          imgWidth,
          imgHeight
        );
        yPosition += imgHeight + 10;
      } catch (error) {
        console.error("Error adding image to PDF:", error);
        doc.text("Image could not be added to report", margin, yPosition);
        yPosition += 10;
      }
    }

    // Safety Recommendations
    yPosition += 10;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Safety Recommendations", margin, yPosition);
    yPosition += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const recommendations = [
      "1. Immediately address the PPE violation",
      "2. Ensure proper PPE is worn before work continues",
      "3. Conduct safety training if needed",
      "4. Document corrective actions taken",
      "5. Review safety protocols with the team",
    ];

    recommendations.forEach((rec) => {
      if (yPosition > pageHeight - margin - 20) {
        doc.addPage();
        yPosition = margin;
      }
      doc.text(rec, margin + 10, yPosition);
      yPosition += 6;
    });

    // Footer
    const footerY = pageHeight - 15;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(
      "This report was generated automatically by the PPE Detection System",
      pageWidth / 2,
      footerY,
      { align: "center" }
    );

    // Save PDF
    const fileName = `ppe_violation_${personId}_${Date.now()}.pdf`;
    const filePath = path.join(this.reportsDir, fileName);

    doc.save(filePath);

    console.log(`📄 PDF report generated: ${fileName}`);
    return filePath;
  }

  /**
   * Update existing PDF with new violation
   * @param {string} personId - Person identifier
   * @param {Object} newViolation - New violation data
   * @returns {Promise<string>} - Path to updated PDF
   */
  async updatePersonViolationReport(personId, newViolation) {
    const existingReportPath = await this.findExistingReport(personId);

    if (existingReportPath) {
      return await this.appendViolationToExistingReport(
        existingReportPath,
        newViolation
      );
    } else {
      return await this.generateViolationReport({
        personId,
        violations: [newViolation.violation],
        timestamp: newViolation.timestamp,
        imageBuffer: newViolation.imageBuffer,
        location: newViolation.location,
      });
    }
  }

  /**
   * Find existing report for a person
   * @param {string} personId - Person identifier
   * @returns {Promise<string|null>} - Path to existing report or null
   */
  async findExistingReport(personId) {
    try {
      const files = fs.readdirSync(this.reportsDir);
      const personReport = files.find((file) => file.includes(`_${personId}_`));
      return personReport ? path.join(this.reportsDir, personReport) : null;
    } catch (error) {
      console.error("Error finding existing report:", error);
      return null;
    }
  }

  /**
   * Append violation to existing PDF
   * @param {string} reportPath - Path to existing report
   * @param {Object} newViolation - New violation data
   * @returns {Promise<string>} - Path to updated PDF
   */
  async appendViolationToExistingReport(reportPath, newViolation) {
    // For simplicity, we'll create a new report with all violations
    // In a production system, you might want to use a more sophisticated PDF editing library
    const fileName = path.basename(reportPath);
    const personId = fileName.split("_")[2]; // Extract person ID from filename

    // Read existing violations from the report (this is a simplified approach)
    // In practice, you'd want to maintain a database of violations per person
    return await this.generateViolationReport({
      personId,
      violations: [newViolation.violation],
      timestamp: newViolation.timestamp,
      imageBuffer: newViolation.imageBuffer,
      location: newViolation.location,
    });
  }

  /**
   * Get all available reports
   * @returns {Array} - Array of report information
   */
  getAllReports() {
    try {
      const files = fs.readdirSync(this.reportsDir);
      return files
        .filter((file) => file.endsWith(".pdf"))
        .map((file) => {
          const stats = fs.statSync(path.join(this.reportsDir, file));
          const parts = file.split("_");
          return {
            fileName: file,
            personId: parts[2],
            createdAt: stats.birthtime,
            size: stats.size,
            path: path.join(this.reportsDir, file),
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error("Error getting reports:", error);
      return [];
    }
  }

  /**
   * Delete a report
   * @param {string} fileName - Name of file to delete
   * @returns {boolean} - Success status
   */
  deleteReport(fileName) {
    try {
      const filePath = path.join(this.reportsDir, fileName);
      fs.unlinkSync(filePath);
      console.log(`🗑️ Report deleted: ${fileName}`);
      return true;
    } catch (error) {
      console.error("Error deleting report:", error);
      return false;
    }
  }
}

export default PDFReportService;
