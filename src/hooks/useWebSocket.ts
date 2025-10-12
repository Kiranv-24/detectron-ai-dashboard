import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface DetectionConfig {
  fps?: number;
  confidence?: number;
  maxDetections?: number;
  model?: string;
}

interface DetectionResult {
  frameId: number;
  detections: Array<{
    class: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
    bbox: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    };
  }>;
  imageInfo: {
    width: number;
    height: number;
  };
  processingTime: number;
  timestamp: string;
  stats: {
    fps: number;
    avgProcessingTime: number;
    totalFrames: number;
  };
}

interface WebSocketHook {
  socket: Socket | null;
  isConnected: boolean;
  isDetecting: boolean;
  connectionError: string | null;
  startDetection: (config?: DetectionConfig) => void;
  stopDetection: () => void;
  sendFrame: (imageData: string) => void;
  lastDetection: DetectionResult | null;
  stats: {
    fps: number;
    avgProcessingTime: number;
    totalFrames: number;
  };
}

export const useWebSocket = (
  serverUrl: string = "http://localhost:3001"
): WebSocketHook => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastDetection, setLastDetection] = useState<DetectionResult | null>(
    null
  );
  const [stats, setStats] = useState({
    fps: 0,
    avgProcessingTime: 0,
    totalFrames: 0,
  });

  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io(serverUrl, {
      transports: ["websocket"],
      timeout: 10000,
      forceNew: true,
    });

    // Connection event handlers
    newSocket.on("connect", () => {
      console.log("🔗 WebSocket connected");
      setIsConnected(true);
      setConnectionError(null);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("🔌 WebSocket disconnected:", reason);
      setIsConnected(false);
      setIsDetecting(false);
      if (reason === "io server disconnect") {
        setConnectionError("Server disconnected");
      }
    });

    newSocket.on("connect_error", (error) => {
      console.error("❌ WebSocket connection error:", error);
      setConnectionError(`Connection failed: ${error.message}`);
      setIsConnected(false);
    });

    // Detection event handlers
    newSocket.on("detection_started", (data) => {
      console.log("🎯 Detection started:", data);
      setIsDetecting(true);
      setConnectionError(null);
    });

    newSocket.on("detection_stopped", (data) => {
      console.log("🛑 Detection stopped:", data);
      setIsDetecting(false);
      setStats(data.stats || stats);
    });

    newSocket.on("detection_result", (data: DetectionResult) => {
      setLastDetection(data);
      setStats(data.stats);
    });

    newSocket.on("detection_error", (error) => {
      console.error("❌ Detection error:", error);
      setConnectionError(error.message || "Detection error");
    });

    newSocket.on("system_message", (message) => {
      console.log("📢 System message:", message);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.close();
    };
  }, [serverUrl]);

  // Start detection
  const startDetection = useCallback(
    (config: DetectionConfig = {}) => {
      if (!socket || !isConnected) {
        console.warn("⚠️ Cannot start detection: WebSocket not connected");
        return;
      }

      const detectionConfig = {
        fps: config.fps || 5,
        confidence: config.confidence || 0.5,
        maxDetections: config.maxDetections || 10,
        model: config.model || "default",
      };

      socket.emit("start_detection", detectionConfig);
    },
    [socket, isConnected]
  );

  // Stop detection
  const stopDetection = useCallback(() => {
    if (socket && isConnected) {
      socket.emit("stop_detection");
    }

    // Clear frame interval
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  }, [socket, isConnected]);

  // Send frame data
  const sendFrame = useCallback(
    (imageData: string) => {
      if (!socket || !isConnected || !isDetecting) {
        return;
      }

      socket.emit("frame_data", {
        imageData,
        timestamp: Date.now(),
      });
    },
    [socket, isConnected, isDetecting]
  );

  // Start frame capture from video element
  const startFrameCapture = useCallback(
    (videoElement: HTMLVideoElement, fps: number = 5) => {
      if (!videoElement || frameIntervalRef.current) {
        return;
      }

      videoRef.current = videoElement;
      const interval = 1000 / fps;

      const captureFrame = () => {
        if (!videoElement || videoElement.readyState !== 4) {
          return;
        }

        try {
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");

          if (!context) return;

          canvas.width = videoElement.videoWidth;
          canvas.height = videoElement.videoHeight;

          context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

          const imageData = canvas.toDataURL("image/jpeg", 0.8);
          sendFrame(imageData);
        } catch (error) {
          console.error("Frame capture error:", error);
        }
      };

      frameIntervalRef.current = setInterval(captureFrame, interval);
    },
    [sendFrame]
  );

  // Stop frame capture
  const stopFrameCapture = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  }, []);

  // Expose frame capture functions
  useEffect(() => {
    if (socket) {
      (socket as any).startFrameCapture = startFrameCapture;
      (socket as any).stopFrameCapture = stopFrameCapture;
    }
  }, [socket, startFrameCapture, stopFrameCapture]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection();
      stopFrameCapture();
    };
  }, [stopDetection, stopFrameCapture]);

  return {
    socket,
    isConnected,
    isDetecting,
    connectionError,
    startDetection,
    stopDetection,
    sendFrame,
    lastDetection,
    stats,
  };
};

