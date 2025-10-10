import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Camera,
  CameraOff,
  Loader2,
  Play,
  Square,
  Wifi,
  WifiOff,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import DetectionResults from "@/components/DetectionResults";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";

interface Detection {
  class: string;
  confidence: number;
}

const LiveDetection = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectionConfig, setDetectionConfig] = useState({
    fps: 5,
    confidence: 0.5,
    maxDetections: 10,
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  // WebSocket hook
  const {
    socket,
    isConnected,
    isDetecting,
    connectionError,
    startDetection,
    stopDetection,
    lastDetection,
    stats,
  } = useWebSocket();

  const startCamera = async () => {
    console.log("🎥 Starting camera...");
    setIsLoading(true);
    setCameraError(null);

    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera not supported in this browser");
      }

      console.log("📱 Requesting camera access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });

      console.log("✅ Camera stream obtained:", stream);

      // Wait a moment for the video element to be available
      let video = videoRef.current;
      if (!video) {
        console.log("⏳ Waiting for video element...");
        // Wait up to 1 second for the video element to be available
        for (let i = 0; i < 10; i++) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          video = videoRef.current;
          if (video) break;
        }
      }

      if (video) {
        console.log("✅ Video element found:", video);

        // Set the stream
        video.srcObject = stream;
        streamRef.current = stream;

        // Simple approach - just play the video
        try {
          await video.play();
          console.log("✅ Video playing successfully");
          setIsStreaming(true);
          setIsLoading(false);
          toast({
            title: "Camera Started",
            description: "Ready for live detection",
          });
        } catch (playError) {
          console.error("❌ Video play failed:", playError);
          // Try again with a slight delay
          setTimeout(async () => {
            try {
              await video.play();
              setIsStreaming(true);
              setIsLoading(false);
              toast({
                title: "Camera Started",
                description: "Ready for live detection",
              });
            } catch (retryError) {
              console.error("❌ Retry failed:", retryError);
              setCameraError("Failed to start video playback");
              setIsLoading(false);
            }
          }, 100);
        }
      } else {
        throw new Error("Video element not found after waiting");
      }
    } catch (error: any) {
      console.error("❌ Camera error:", error);
      setIsLoading(false);
      let errorMessage = "Failed to access camera. Please check permissions.";

      if (error.name === "NotAllowedError") {
        errorMessage =
          "Camera access denied. Please allow camera permissions and refresh the page.";
      } else if (error.name === "NotFoundError") {
        errorMessage = "No camera found. Please connect a camera device.";
      } else if (error.name === "NotSupportedError") {
        errorMessage = "Camera not supported in this browser.";
      } else if (error.name === "NotReadableError") {
        errorMessage = "Camera is already in use by another application.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      setCameraError(errorMessage);
      toast({
        title: "Camera Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
    setIsLoading(false);
    setCameraError(null);

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const toggleDetection = () => {
    if (isDetecting) {
      stopDetection();
    } else {
      startDetection(detectionConfig);
    }
  };

  // Function to draw bounding boxes on video
  const drawBoundingBoxes = (
    detections: any[],
    videoElement: HTMLVideoElement
  ) => {
    const canvas = canvasRef.current;
    if (!canvas || !videoElement) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw bounding boxes
    detections.forEach((detection, index) => {
      const { x, y, width, height, class: className, confidence } = detection;

      // Calculate actual positions on canvas
      const canvasX = x - width / 2;
      const canvasY = y - height / 2;
      const canvasWidth = width;
      const canvasHeight = height;

      // Choose color based on class
      const colors = [
        "#3b82f6",
        "#ef4444",
        "#10b981",
        "#f59e0b",
        "#8b5cf6",
        "#06b6d4",
      ];
      const color = colors[index % colors.length];

      // Draw bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(canvasX, canvasY, canvasWidth, canvasHeight);

      // Draw label background
      const label = `${className} ${(confidence * 100).toFixed(0)}%`;
      ctx.font = "16px Arial";
      ctx.fillStyle = color;
      const textWidth = ctx.measureText(label).width;
      ctx.fillRect(canvasX, canvasY - 25, textWidth + 10, 25);

      // Draw label text
      ctx.fillStyle = "white";
      ctx.fillText(label, canvasX + 5, canvasY - 8);
    });
  };

  // Start frame capture when detection starts
  useEffect(() => {
    if (isDetecting && isStreaming && videoRef.current) {
      // Start frame capture using the WebSocket hook's method
      if (socket && (socket as any).startFrameCapture) {
        (socket as any).startFrameCapture(
          videoRef.current,
          detectionConfig.fps
        );
      }
    } else {
      // Stop frame capture
      if (socket && (socket as any).stopFrameCapture) {
        (socket as any).stopFrameCapture();
      }
    }
  }, [isDetecting, isStreaming, detectionConfig.fps]);

  // Draw bounding boxes when detections are received
  useEffect(() => {
    if (
      lastDetection &&
      lastDetection.detections.length > 0 &&
      videoRef.current
    ) {
      drawBoundingBoxes(lastDetection.detections, videoRef.current);
    }
  }, [lastDetection]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center space-y-2 mb-8 animate-fade-in">
            <h1 className="text-4xl font-bold text-foreground">
              Live Detection
            </h1>
            <p className="text-muted-foreground">
              Real-time object detection with your camera
            </p>

            {/* Connection Status */}
            <div className="flex items-center justify-center gap-2 mt-4">
              <div
                className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                  isConnected
                    ? "bg-green-500/20 text-green-600 border border-green-500/30"
                    : "bg-red-500/20 text-red-600 border border-red-500/30"
                }`}
              >
                {isConnected ? (
                  <Wifi className="w-4 h-4" />
                ) : (
                  <WifiOff className="w-4 h-4" />
                )}
                {isConnected ? "Connected to Server" : "Disconnected"}
              </div>

              {connectionError && (
                <div className="text-xs text-red-500 max-w-xs">
                  {connectionError}
                </div>
              )}
            </div>
          </div>

          <Card className="p-8 bg-card/50 backdrop-blur-sm border-border">
            <div className="space-y-4">
              <div className="relative aspect-video bg-muted/20 rounded-lg overflow-hidden border border-border">
                {/* Always render video element, but hide it when not streaming */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${
                    isStreaming ? "block" : "hidden"
                  }`}
                />

                {/* Canvas for detection overlays */}
                {isStreaming && (
                  <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0 w-full h-full pointer-events-none"
                  />
                )}

                {/* Stats overlay */}
                {isStreaming && (isDetecting || stats.fps > 0) && (
                  <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-card/80 backdrop-blur-sm border border-border">
                    <div className="flex items-center gap-2">
                      {isConnected ? (
                        <Wifi className="w-3 h-3 text-green-500" />
                      ) : (
                        <WifiOff className="w-3 h-3 text-red-500" />
                      )}
                      <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">
                        {Math.round(stats.fps)} FPS
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(stats.avgProcessingTime)}ms
                      </span>
                    </div>
                  </div>
                )}

                {/* Loading/Error state overlay */}
                {!isStreaming && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                        {isLoading ? (
                          <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        ) : cameraError ? (
                          <CameraOff className="w-8 h-8 text-destructive" />
                        ) : (
                          <Camera className="w-8 h-8 text-primary" />
                        )}
                      </div>
                      {isLoading ? (
                        <div className="space-y-2">
                          <p className="text-muted-foreground">
                            Starting camera...
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Check browser console for details
                          </p>
                        </div>
                      ) : cameraError ? (
                        <div className="space-y-2">
                          <p className="text-destructive font-medium">
                            Camera Error
                          </p>
                          <p className="text-sm text-muted-foreground max-w-xs">
                            {cameraError}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Check browser permissions and console
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-muted-foreground">
                            Camera not started
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Click "Start Camera" to begin
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                {!isStreaming ? (
                  <Button
                    variant="hero"
                    size="lg"
                    className="flex-1"
                    onClick={() => {
                      console.log("🔘 Start Camera button clicked!");
                      startCamera();
                    }}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Camera className="w-5 h-5" />
                        Start Camera
                      </>
                    )}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant={isDetecting ? "destructive" : "accent"}
                      size="lg"
                      className="flex-1"
                      onClick={toggleDetection}
                    >
                      {isDetecting ? (
                        <>
                          <Square className="w-5 h-5" />
                          Stop Detection
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5" />
                          Start Detection
                        </>
                      )}
                    </Button>
                    <Button variant="outline" size="lg" onClick={stopCamera}>
                      <CameraOff className="w-5 h-5" />
                      Stop Camera
                    </Button>
                  </>
                )}
              </div>

              {cameraError && !isLoading && (
                <div className="mt-4 space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startCamera}
                    className="w-full"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Retry Camera
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      console.log("=== Camera Debug Info ===");
                      console.log(
                        "Navigator.mediaDevices:",
                        navigator.mediaDevices
                      );
                      console.log(
                        "getUserMedia support:",
                        !!navigator.mediaDevices?.getUserMedia
                      );
                      console.log("Secure context:", window.isSecureContext);
                      console.log("Hostname:", window.location.hostname);
                      console.log("Video ref:", videoRef.current);
                      console.log("Stream ref:", streamRef.current);

                      // Test camera access directly
                      try {
                        console.log("🔍 Testing camera access...");
                        const stream =
                          await navigator.mediaDevices.getUserMedia({
                            video: true,
                          });
                        console.log("✅ Camera access successful:", stream);
                        stream.getTracks().forEach((track) => track.stop());
                      } catch (error) {
                        console.error("❌ Camera access failed:", error);
                      }
                      console.log("==========================");
                    }}
                    className="w-full text-xs"
                  >
                    Debug Info (Check Console)
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {lastDetection && lastDetection.detections.length > 0 && (
            <DetectionResults detections={lastDetection.detections} />
          )}

          {/* Real-time Stats */}
          {stats.totalFrames > 0 && (
            <Card className="p-4 bg-card/30 backdrop-blur-sm border-border">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary">
                    {Math.round(stats.fps)}
                  </p>
                  <p className="text-sm text-muted-foreground">FPS</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-secondary">
                    {Math.round(stats.avgProcessingTime)}ms
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Avg Processing
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-accent">
                    {stats.totalFrames}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Frames</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveDetection;
