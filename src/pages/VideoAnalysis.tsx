import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Upload,
  Loader2,
  Video,
  X,
  FileVideo,
  AlertCircle,
  Play,
  Pause,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import VideoAnalysisResults from "@/components/VideoAnalysisResults";
import { useToast } from "@/hooks/use-toast";

interface Violation {
  type: string;
  confidence: number;
  timestamp: number;
  frame: number;
}

const VideoAnalysis = () => {
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedVideo(file);
      const url = URL.createObjectURL(file);
      setVideoPreview(url);
      setAnalysisResults(null);
    }
  };

  const handleAnalysis = async () => {
    if (!selectedVideo) return;

    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append("video", selectedVideo);

      const response = await fetch("http://localhost:3001/api/video/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Analysis failed");
      }

      setAnalysisResults(result);

      toast({
        title: "Analysis Complete",
        description: `Found ${result.totalViolations} violations in ${result.frameCount} frames`,
        variant: result.totalViolations > 0 ? "destructive" : "default",
      });
    } catch (error: any) {
      console.error("Analysis error:", error);

      toast({
        title: "Analysis Failed",
        description: error.message || "Could not process video",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    setSelectedVideo(null);
    setVideoPreview(null);
    setAnalysisResults(null);
    setCurrentFrame(0);
    setIsPlaying(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Draw bounding boxes on video frame
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
      const {
        x,
        y,
        width,
        height,
        class: className,
        confidence,
        bbox,
      } = detection;

      // Use bbox if available (absolute coordinates), otherwise calculate from center
      let canvasX, canvasY, canvasWidth, canvasHeight;

      if (bbox && bbox.x1 !== undefined) {
        // Use absolute bounding box coordinates
        canvasX = bbox.x1;
        canvasY = bbox.y1;
        canvasWidth = bbox.x2 - bbox.x1;
        canvasHeight = bbox.y2 - bbox.y1;
      } else {
        // Calculate from center coordinates (fallback)
        canvasX = x - width / 2;
        canvasY = y - height / 2;
        canvasWidth = width;
        canvasHeight = height;
      }

      // Choose color based on class type (violations vs proper PPE)
      const isViolation =
        className.toLowerCase().includes("no-") ||
        className.toLowerCase().includes("no_") ||
        className.toLowerCase().includes("missing");

      const isProperPPE =
        (className.toLowerCase().includes("helmet") &&
          !className.toLowerCase().includes("no")) ||
        (className.toLowerCase().includes("jacket") &&
          !className.toLowerCase().includes("no")) ||
        (className.toLowerCase().includes("mask") &&
          !className.toLowerCase().includes("no")) ||
        (className.toLowerCase().includes("shoes") &&
          !className.toLowerCase().includes("no")) ||
        (className.toLowerCase().includes("belt") &&
          !className.toLowerCase().includes("no"));

      // Use red for violations, green for proper PPE, cyan for person
      let color = "#00bcd4"; // Default cyan
      if (isViolation) {
        color = "#ff1744"; // Red for violations
      } else if (isProperPPE) {
        color = "#00ff00"; // Green for proper PPE
      } else if (className.toLowerCase() === "person") {
        color = "#2196F3"; // Blue for person
      }

      // Draw bounding box with thicker line for better visibility
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.strokeRect(canvasX, canvasY, canvasWidth, canvasHeight);

      // Draw label background with better padding
      const label = `${className} ${(confidence * 100).toFixed(0)}%`;
      ctx.font = "bold 18px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = color;
      const textMetrics = ctx.measureText(label);
      const textWidth = textMetrics.width;
      const textHeight = 28;

      // Draw background rectangle with rounded corners
      const padding = 8;
      const bgX = canvasX;
      const bgY = canvasY - textHeight - padding;
      const bgWidth = textWidth + padding * 2;
      const bgHeight = textHeight;

      ctx.fillStyle = color;
      ctx.fillRect(bgX, bgY, bgWidth, bgHeight);

      // Add subtle border for better contrast
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(bgX, bgY, bgWidth, bgHeight);

      // Draw label text with better contrast and positioning
      ctx.fillStyle = "white";
      ctx.font = "bold 18px 'Segoe UI', Arial, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(label, bgX + padding, bgY + textHeight / 2);
    });
  };

  // Handle video time update to show annotations for current frame
  const handleTimeUpdate = () => {
    if (!analysisResults?.frameAnalysis || !videoRef.current) return;

    const video = videoRef.current;
    const currentTime = video.currentTime;
    const fps = analysisResults.fpsAnalyzed || 1;
    const frameIndex = Math.floor(currentTime * fps);

    if (
      frameIndex !== currentFrame &&
      frameIndex < analysisResults.frameAnalysis.length
    ) {
      setCurrentFrame(frameIndex);
      const frameData = analysisResults.frameAnalysis[frameIndex];
      if (frameData && frameData.detections) {
        drawBoundingBoxes(frameData.detections, video);
      }
    }
  };

  // Handle play/pause
  const togglePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="text-center space-y-2 mb-8 animate-fade-in">
            <h1 className="text-4xl font-bold text-foreground">
              Video Analysis
            </h1>
            <p className="text-muted-foreground">
              Upload a video to detect PPE violations
            </p>
          </div>

          <Card className="p-8 bg-card/50 backdrop-blur-sm border-border">
            {!selectedVideo ? (
              <div className="space-y-4">
                <div
                  className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-all duration-300 hover:bg-muted/20"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                      <FileVideo className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <p className="text-lg font-medium text-foreground mb-1">
                        Click to upload video
                      </p>
                      <p className="text-sm text-muted-foreground">
                        MP4, WebM, QuickTime up to 200MB
                      </p>
                    </div>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden border border-border bg-muted/20">
                  <video
                    ref={videoRef}
                    src={videoPreview || undefined}
                    onTimeUpdate={handleTimeUpdate}
                    className="w-full max-h-[500px]"
                  />
                  {/* Canvas overlay for annotations */}
                  {analysisResults && (
                    <canvas
                      ref={canvasRef}
                      className="absolute top-0 left-0 w-full h-full pointer-events-none"
                      style={{ maxHeight: "500px" }}
                    />
                  )}
                  {isProcessing && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                      <div className="text-center space-y-4">
                        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                        <div>
                          <p className="text-white font-medium">
                            Processing video...
                          </p>
                          <p className="text-white/80 text-sm">
                            Analyzing frames for PPE violations
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={handleClear}
                    disabled={isProcessing}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Video Controls */}
                {analysisResults && (
                  <div className="flex items-center justify-center gap-4 p-4 bg-muted/30 rounded-lg border border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={togglePlayPause}
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      {isPlaying ? "Pause" : "Play"}
                    </Button>
                    <div className="text-sm text-muted-foreground">
                      Frame {currentFrame + 1} of {analysisResults.frameCount}
                    </div>
                    {analysisResults.frameAnalysis[currentFrame]
                      ?.hasViolations && (
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-destructive/20 text-destructive border border-destructive/30">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">
                          Violations Detected
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="hero"
                    size="lg"
                    className="flex-1"
                    onClick={handleAnalysis}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        Analyze Video
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleClear}
                    disabled={isProcessing}
                  >
                    <X className="w-4 h-4" />
                    Clear
                  </Button>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg border border-border">
                  <div className="flex items-start gap-3">
                    <FileVideo className="w-5 h-5 text-primary mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {selectedVideo.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Size: {(selectedVideo.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {analysisResults && (
            <Card className="p-6 bg-card/30 backdrop-blur-sm border-border">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      {analysisResults.totalViolations > 0 ? (
                        <AlertCircle className="w-5 h-5 text-destructive" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-green-500" />
                      )}
                      Analysis Results
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Analyzed {analysisResults.frameCount} frames at{" "}
                      {analysisResults.fpsAnalyzed} FPS
                    </p>
                  </div>
                  {analysisResults.totalViolations > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-destructive/20 text-destructive border border-destructive/30">
                      <span className="text-sm font-semibold">
                        {analysisResults.totalViolations} Violations
                      </span>
                    </div>
                  )}
                </div>

                {analysisResults.totalViolations > 0 ? (
                  <VideoAnalysisResults
                    violations={analysisResults.violations}
                    duration={analysisResults.videoMetadata.duration}
                  />
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-8 h-8 text-green-500" />
                    </div>
                    <p className="text-lg font-medium text-foreground">
                      No Violations Detected
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      All PPE appears to be properly worn throughout the video
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoAnalysis;
