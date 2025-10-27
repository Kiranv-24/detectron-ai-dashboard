import { RoboflowService } from "./roboflow.js";
import { ImageProcessor } from "./imageProcessor.js";
import { PPETracker } from "./ppeTracker.js";

export class WebSocketHandler {
  constructor(io, roboflowService, imageProcessor) {
    this.io = io;
    this.roboflowService = roboflowService;
    this.imageProcessor = imageProcessor;
    this.ppeTracker = new PPETracker();
    this.activeSessions = new Map();
    this.frameProcessingQueue = new Map();
    this.maxConcurrentProcessing = 5; // Increased from 3
    this.currentProcessingCount = 0;
    this.frameInterval = 200; // Process frames every 200ms (5 FPS)
    this.frameDropThreshold = 3; // Drop old frames if queue is too long
  }

  /**
   * Handle start detection request
   * @param {Object} socket - WebSocket socket instance
   * @param {Object} data - Configuration data
   */
  async handleStartDetection(socket, data) {
    try {
      const sessionId = socket.id;
      const config = {
        fps: data.fps || 5,
        confidence: data.confidence || 0.5,
        maxDetections: data.maxDetections || 10,
        model: data.model || "default",
      };

      // Initialize session
      this.activeSessions.set(sessionId, {
        config,
        isActive: true,
        frameCount: 0,
        lastProcessedTime: 0,
        processingQueue: [],
        stats: {
          totalFrames: 0,
          processedFrames: 0,
          errors: 0,
          avgProcessingTime: 0,
          startTime: Date.now(),
          droppedFrames: 0,
        },
      });

      // Register session with PPE tracker
      this.ppeTracker.registerSession(sessionId);

      // Send acknowledgment
      socket.emit("detection_started", {
        sessionId,
        config,
        timestamp: new Date().toISOString(),
      });

      console.log(`🎯 Detection started for session: ${sessionId}`);
    } catch (error) {
      console.error("Error starting detection:", error);
      socket.emit("detection_error", {
        error: "Failed to start detection",
        message: error.message,
      });
    }
  }

  /**
   * Handle frame data from client
   * @param {Object} socket - WebSocket socket instance
   * @param {Object} data - Frame data
   */
  async handleFrameData(socket, data) {
    try {
      const sessionId = socket.id;
      const session = this.activeSessions.get(sessionId);

      if (!session || !session.isActive) {
        return;
      }

      const now = Date.now();
      const timeSinceLastProcessed = now - session.lastProcessedTime;

      // Throttle frame processing based on configured FPS
      if (timeSinceLastProcessed < 1000 / session.config.fps) {
        return;
      }

      session.frameCount++;
      session.lastProcessedTime = now;

      // Add frame to processing queue
      const frameData = {
        id: session.frameCount,
        imageData: data.imageData,
        timestamp: now,
        sessionId,
      };

      // Drop old frames if queue is getting too long
      if (session.processingQueue.length > this.frameDropThreshold) {
        session.processingQueue.shift(); // Remove oldest frame
        session.stats.droppedFrames = (session.stats.droppedFrames || 0) + 1;
      }

      session.processingQueue.push(frameData);

      // Process frame asynchronously with queue management
      this.processFrameAsync(socket, frameData, session);
    } catch (error) {
      console.error("Error handling frame data:", error);
      socket.emit("detection_error", {
        error: "Frame processing error",
        message: error.message,
      });
    }
  }

  /**
   * Process frame asynchronously with concurrency control
   * @param {Object} socket - WebSocket socket instance
   * @param {Object} frameData - Frame data to process
   * @param {Object} session - Session information
   */
  async processFrameAsync(socket, frameData, session) {
    // Check if we can process more frames concurrently
    if (this.currentProcessingCount >= this.maxConcurrentProcessing) {
      // Queue is full, frame will be processed when capacity is available
      // The latest frame will be taken from the queue when ready
      return;
    }

    // Increment processing count
    this.currentProcessingCount++;

    try {
      const startTime = Date.now();

      // Convert base64 image data to buffer
      const imageBuffer = Buffer.from(
        frameData.imageData.split(",")[1],
        "base64"
      );

      // Process image (can skip resizing if image is already appropriate size)
      const processedImage = await this.imageProcessor.processImage(
        imageBuffer
      );

      // Run detection (use faster inference if available)
      const detectionResult = await this.roboflowService.detectObjects(
        processedImage
      );

      const processingTime = Date.now() - startTime;

      // Update session stats
      session.stats.totalFrames++;
      session.stats.processedFrames++;

      // Use exponential moving average for smoother stats
      session.stats.avgProcessingTime =
        session.stats.avgProcessingTime === 0
          ? processingTime
          : session.stats.avgProcessingTime * 0.7 + processingTime * 0.3;

      // Filter detections by confidence
      const filteredDetections = detectionResult.detections
        .filter(
          (detection) => detection.confidence >= session.config.confidence
        )
        .slice(0, session.config.maxDetections);

      // Draw bounding boxes on image if there are detections
      let annotatedImageBuffer = imageBuffer;
      if (filteredDetections.length > 0) {
        try {
          annotatedImageBuffer = await this.imageProcessor.drawBoundingBoxes(
            imageBuffer,
            filteredDetections
          );
        } catch (error) {
          console.error("Error drawing bounding boxes:", error);
          // Use original image if drawing fails
          annotatedImageBuffer = imageBuffer;
        }
      }

      // Process PPE violations and get results - pass annotated image
      const violationCheck = await this.ppeTracker.processDetection(
        frameData.sessionId,
        filteredDetections,
        annotatedImageBuffer
      );

      console.log(`📊 Violation check result:`, {
        hasViolations: violationCheck.hasViolations,
        violations: violationCheck.violations,
        imageBufferSize: imageBuffer ? imageBuffer.length : 0,
      });

      // Send results to client with PPE violation info
      socket.emit("detection_result", {
        frameId: frameData.id,
        detections: filteredDetections,
        imageInfo: detectionResult.image,
        processingTime,
        timestamp: new Date().toISOString(),
        stats: {
          fps:
            session.stats.processedFrames > 0
              ? session.stats.processedFrames /
                ((Date.now() - session.stats.startTime || Date.now()) / 1000)
              : 0,
          avgProcessingTime: session.stats.avgProcessingTime,
          totalFrames: session.stats.totalFrames,
          droppedFrames: session.stats.droppedFrames || 0,
        },
        ppeViolations: violationCheck.violations,
        hasViolations: violationCheck.hasViolations,
        isAllProperPPE: violationCheck.isAllProperPPE,
      });
    } catch (error) {
      console.error("Frame processing error:", error);

      session.stats.errors++;

      socket.emit("detection_error", {
        frameId: frameData.id,
        error: "Processing failed",
        message: error.message,
      });
    } finally {
      // Decrement processing count when done
      this.currentProcessingCount--;

      // Check if there are more frames in the queue to process
      if (
        session.processingQueue.length > 0 &&
        frameData.id < session.frameCount
      ) {
        const nextFrame = session.processingQueue.shift();
        if (nextFrame) {
          this.processFrameAsync(socket, nextFrame, session);
        }
      }
    }
  }

  /**
   * Handle stop detection request
   * @param {Object} socket - WebSocket socket instance
   */
  handleStopDetection(socket) {
    try {
      const sessionId = socket.id;
      const session = this.activeSessions.get(sessionId);

      if (session) {
        session.isActive = false;

        // Stop PPE tracking for this session
        this.ppeTracker.stopEmailAlertTimer(sessionId);

        // Send final stats
        socket.emit("detection_stopped", {
          sessionId,
          stats: session.stats,
          timestamp: new Date().toISOString(),
        });

        console.log(`🛑 Detection stopped for session: ${sessionId}`);
      }
    } catch (error) {
      console.error("Error stopping detection:", error);
      socket.emit("detection_error", {
        error: "Failed to stop detection",
        message: error.message,
      });
    }
  }

  /**
   * Handle client disconnect
   * @param {Object} socket - WebSocket socket instance
   */
  handleDisconnect(socket) {
    try {
      const sessionId = socket.id;
      const session = this.activeSessions.get(sessionId);

      if (session) {
        session.isActive = false;
        this.activeSessions.delete(sessionId);

        // Unregister from PPE tracker
        this.ppeTracker.unregisterSession(sessionId);

        console.log(`👋 Session cleaned up: ${sessionId}`);
      }
    } catch (error) {
      console.error("Error handling disconnect:", error);
    }
  }

  /**
   * Get active sessions statistics
   * @returns {Object} Statistics about active sessions
   */
  getStats() {
    const sessions = Array.from(this.activeSessions.values());

    return {
      activeSessions: sessions.filter((s) => s.isActive).length,
      totalSessions: sessions.length,
      totalFrames: sessions.reduce((sum, s) => sum + s.stats.totalFrames, 0),
      totalErrors: sessions.reduce((sum, s) => sum + s.stats.errors, 0),
      avgProcessingTime:
        sessions.reduce((sum, s) => sum + s.stats.avgProcessingTime, 0) /
          sessions.length || 0,
    };
  }

  /**
   * Broadcast system message to all connected clients
   * @param {string} message - Message to broadcast
   * @param {string} type - Message type
   */
  broadcastSystemMessage(message, type = "info") {
    this.io.emit("system_message", {
      message,
      type,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Cleanup inactive sessions
   */
  cleanupInactiveSessions() {
    const now = Date.now();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (
        !session.isActive &&
        now - session.lastProcessedTime > inactiveThreshold
      ) {
        this.activeSessions.delete(sessionId);
        console.log(`🧹 Cleaned up inactive session: ${sessionId}`);
      }
    }
  }
}
