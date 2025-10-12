import { RoboflowService } from "./roboflow.js";
import { ImageProcessor } from "./imageProcessor.js";

export class WebSocketHandler {
  constructor(io, roboflowService, imageProcessor) {
    this.io = io;
    this.roboflowService = roboflowService;
    this.imageProcessor = imageProcessor;
    this.activeSessions = new Map();
    this.frameProcessingQueue = new Map();
    this.maxConcurrentProcessing = 3;
    this.frameInterval = 200; // Process frames every 200ms (5 FPS)
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
        },
      });

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

      session.processingQueue.push(frameData);

      // Process frame asynchronously
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
   * Process frame asynchronously
   * @param {Object} socket - WebSocket socket instance
   * @param {Object} frameData - Frame data to process
   * @param {Object} session - Session information
   */
  async processFrameAsync(socket, frameData, session) {
    try {
      const startTime = Date.now();

      // Convert base64 image data to buffer
      const imageBuffer = Buffer.from(
        frameData.imageData.split(",")[1],
        "base64"
      );

      // Process image
      const processedImage = await this.imageProcessor.processImage(
        imageBuffer
      );

      // Run detection
      const detectionResult = await this.roboflowService.detectObjects(
        processedImage
      );

      const processingTime = Date.now() - startTime;

      // Update session stats
      session.stats.totalFrames++;
      session.stats.processedFrames++;
      session.stats.avgProcessingTime =
        (session.stats.avgProcessingTime + processingTime) / 2;

      // Filter detections by confidence
      const filteredDetections = detectionResult.detections
        .filter(
          (detection) => detection.confidence >= session.config.confidence
        )
        .slice(0, session.config.maxDetections);

      // Send results to client
      socket.emit("detection_result", {
        frameId: frameData.id,
        detections: filteredDetections,
        imageInfo: detectionResult.image,
        processingTime,
        timestamp: new Date().toISOString(),
        stats: {
          fps:
            session.stats.totalFrames > 0
              ? session.stats.processedFrames /
                ((Date.now() - session.lastProcessedTime) / 1000)
              : 0,
          avgProcessingTime: session.stats.avgProcessingTime,
          totalFrames: session.stats.totalFrames,
        },
      });
    } catch (error) {
      console.error("Frame processing error:", error);

      session.stats.errors++;

      socket.emit("detection_error", {
        frameId: frameData.id,
        error: "Processing failed",
        message: error.message,
      });
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

