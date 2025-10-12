import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import multer from "multer";
import sharp from "sharp";
import dotenv from "dotenv";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { RoboflowService } from "./services/roboflow.js";
import { WebSocketHandler } from "./services/websocket.js";
import { ImageProcessor } from "./services/imageProcessor.js";

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:8080",
    methods: ["GET", "POST"],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Rate limiting
const rateLimiter = new RateLimiterMemory({
  keyPrefix: "middleware",
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60,
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:8080",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting middleware
app.use(async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    res.status(429).json({ error: "Too many requests" });
  }
});

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Initialize services
const roboflowService = new RoboflowService();
const imageProcessor = new ImageProcessor();
const wsHandler = new WebSocketHandler(io, roboflowService, imageProcessor);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// API endpoints
app.post("/api/detect/image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    const imageBuffer = req.file.buffer;
    const processedImage = await imageProcessor.processImage(imageBuffer);
    const detections = await roboflowService.detectObjects(processedImage);

    res.json({
      success: true,
      detections,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Detection error:", error);
    res.status(500).json({
      error: "Detection failed",
      message: error.message,
    });
  }
});

// WebSocket connection handling
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("start_detection", (data) => {
    wsHandler.handleStartDetection(socket, data);
  });

  socket.on("stop_detection", () => {
    wsHandler.handleStopDetection(socket);
  });

  socket.on("frame_data", (data) => {
    wsHandler.handleFrameData(socket, data);
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
    wsHandler.handleDisconnect(socket);
  });

  socket.on("error", (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Server error:", error);

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large" });
    }
  }

  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Something went wrong",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
  console.log(
    `🔗 CORS enabled for: ${process.env.CORS_ORIGIN || "http://localhost:8080"}`
  );
  console.log(`🤖 Roboflow model: ${process.env.ROBOFLOW_MODEL_URL}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

