import express from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { VideoProcessor } from "../services/videoProcessor.js";
import PPETracker from "../services/ppeTracker.js";
import { violationStorage } from "../services/violationStorageService.js";
import { ImageProcessor } from "../services/imageProcessor.js";
import { RoboflowService } from "../services/roboflow.js";
import { EmailService } from "../services/emailService.js";

const router = express.Router();

// Configure multer for video upload
const storage = multer.diskStorage({
  destination: "./uploads/videos",
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    cb(null, `${uniqueId}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-msvideo",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only MP4, WebM, QuickTime, and AVI videos are allowed."
        )
      );
    }
  },
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit
  },
});

// Initialize detector - use Roboflow API for video analysis
const detector = new RoboflowService();
const imageProcessor = new ImageProcessor();
const ppeTracker = new PPETracker();
const emailService = new EmailService();

router.post("/analyze", upload.single("video"), async (req, res) => {
  let videoPath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No video file uploaded" });
    }

    videoPath = req.file.path;
    console.log(`🎬 Starting video analysis for: ${req.file.originalname}`);

    const videoProcessor = new VideoProcessor();

    // Extract and analyze frames (1 frame per second for speed)
    const fps = 1;
    const allViolations = [];
    const frameAnalysis = [];
    const violationFrames = []; // Store frames with violations for email
    let currentProgress = 0;

    const videoData = await videoProcessor.processVideo(
      videoPath,
      fps,
      async (frameData) => {
        currentProgress++;

        // Process frame for detection
        const processedFrame = await imageProcessor.processImage(
          frameData.buffer
        );
        const detectionResult = await detector.detectObjects(processedFrame);

        // Extract detections array from the result
        const detections = detectionResult.detections || [];

        // Check for violations
        const violationCheck = ppeTracker.checkViolations(detections);

        // Store frame analysis data for annotations
        frameAnalysis.push({
          frameNumber: frameData.frameNumber,
          timestamp: frameData.timestamp,
          detections: detections,
          violations: violationCheck.violations,
          hasViolations: violationCheck.hasViolations,
          imageWidth: frameData.width,
          imageHeight: frameData.height,
        });

        if (violationCheck.hasViolations) {
          // Store violation
          const storageResult = await violationStorage.storeViolation(
            detections,
            frameData.buffer,
            req.file.originalname
          );

          // Store frame data for email
          violationFrames.push({
            frameNumber: frameData.frameNumber,
            buffer: frameData.buffer,
            violations: violationCheck.violations,
            detections: detections,
          });

          // Add to violations array
          violationCheck.violations.forEach((violationType) => {
            allViolations.push({
              type: violationType,
              confidence:
                detections.find((d) => d.class === violationType)?.confidence ||
                0.85,
              timestamp: frameData.timestamp,
              frame: frameData.frameNumber,
            });
          });

          console.log(
            `⚠️ Found violations at ${
              frameData.frameNumber
            }: ${violationCheck.violations.join(", ")}`
          );
        }
      }
    );

    // Generate PDF report if violations found
    if (allViolations.length > 0) {
      console.log(
        `📄 Generating PDF report for ${allViolations.length} violations`
      );
      await violationStorage.generatePendingPDFs();

      // Send email alert for video analysis violations
      console.log(`📧 Sending email alert for video analysis violations`);
      try {
        // Get the most recent violation frame for email
        if (violationFrames.length > 0) {
          const recentFrame = violationFrames.sort(
            (a, b) => b.frameNumber - a.frameNumber
          )[0];
          const uniqueViolations = [
            ...new Set(allViolations.map((v) => v.type)),
          ];

          await emailService.sendViolationAlert({
            imageBuffer: recentFrame.buffer,
            violations: uniqueViolations,
            timestamp: new Date(),
          });

          console.log(
            `✅ Email alert sent for video analysis with ${uniqueViolations.length} violation types`
          );
        }
      } catch (emailError) {
        console.error(
          `❌ Failed to send email alert for video analysis:`,
          emailError
        );
      }
    }

    const analysisId = path.basename(
      req.file.filename,
      path.extname(req.file.filename)
    );
    const analysisResults = {
      success: true,
      analysisId,
      videoId: analysisId,
      originalName: req.file.originalname,
      timestamp: new Date().toISOString(),
      videoMetadata: videoData.metadata,
      violations: allViolations,
      totalViolations: allViolations.length,
      frameCount: videoData.frameCount,
      fpsAnalyzed: fps,
      frameAnalysis: frameAnalysis, // Include frame-by-frame analysis for annotations
    };

    res.json(analysisResults);
    console.log(
      `✅ Video analysis complete: ${allViolations.length} violations found`
    );
  } catch (error) {
    console.error("Error processing video:", error);
    res.status(500).json({
      error: "Error processing video",
      message: error.message,
    });
  } finally {
    // Clean up video file after processing (optional - you might want to keep them)
    // Uncomment if you want to auto-delete videos after processing
    // if (videoPath && fs.existsSync(videoPath)) {
    //     fs.unlinkSync(videoPath);
    // }
  }
});

router.get("/results/:analysisId", async (req, res) => {
  try {
    const { analysisId } = req.params;
    const allViolations = violationStorage.getAllViolations();

    // Find violations for this analysis
    const results = Object.values(allViolations).filter((person) =>
      person.reports.some((report) => report.id.includes(analysisId))
    );

    if (!results || results.length === 0) {
      return res.status(404).json({ error: "Analysis results not found" });
    }

    res.json(results);
  } catch (error) {
    console.error("Error retrieving analysis results:", error);
    res.status(500).json({ error: "Error retrieving analysis results" });
  }
});

router.get("/list", async (req, res) => {
  try {
    const allViolations = violationStorage.getAllViolations();
    const recentViolations = violationStorage.getRecentViolations(50);
    res.json({ allViolations, recentViolations });
  } catch (error) {
    console.error("Error listing analyses:", error);
    res.status(500).json({ error: "Error listing analyses" });
  }
});

export default router;
