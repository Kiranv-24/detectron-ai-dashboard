import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, CameraOff, Loader2, Play, Square } from "lucide-react";
import Navbar from "@/components/Navbar";
import DetectionResults from "@/components/DetectionResults";
import { useToast } from "@/hooks/use-toast";

interface Detection {
  class: string;
  confidence: number;
}

const LiveDetection = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [fps, setFps] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);
        
        toast({
          title: "Camera Started",
          description: "Ready for live detection",
        });
      }
    } catch (error) {
      toast({
        title: "Camera Error",
        description: "Failed to access camera. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setIsStreaming(false);
      setIsDetecting(false);
      setDetections([]);
    }
  };

  const toggleDetection = () => {
    if (isDetecting) {
      setIsDetecting(false);
    } else {
      setIsDetecting(true);
      runDetection();
    }
  };

  const runDetection = () => {
    // Simulate continuous detection - replace with actual Roboflow API calls
    const interval = setInterval(() => {
      if (!isDetecting) {
        clearInterval(interval);
        return;
      }

      // Mock detections
      const mockDetections: Detection[] = [
        { class: "Person", confidence: 0.89 + Math.random() * 0.1 },
        { class: "Phone", confidence: 0.75 + Math.random() * 0.15 },
      ];
      
      setDetections(mockDetections);
      setFps(Math.floor(15 + Math.random() * 10));
    }, 500);
  };

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
            <h1 className="text-4xl font-bold text-foreground">Live Detection</h1>
            <p className="text-muted-foreground">Real-time object detection with your camera</p>
          </div>
          
          <Card className="p-8 bg-card/50 backdrop-blur-sm border-border">
            <div className="space-y-4">
              <div className="relative aspect-video bg-muted/20 rounded-lg overflow-hidden border border-border">
                {isStreaming ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute top-0 left-0 w-full h-full"
                    />
                    {isDetecting && (
                      <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-card/80 backdrop-blur-sm border border-border">
                        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                        <span className="text-sm font-medium text-foreground">
                          {fps} FPS
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                        <Camera className="w-8 h-8 text-primary" />
                      </div>
                      <p className="text-muted-foreground">Camera not started</p>
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
                    onClick={startCamera}
                  >
                    <Camera className="w-5 h-5" />
                    Start Camera
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
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={stopCamera}
                    >
                      <CameraOff className="w-5 h-5" />
                      Stop Camera
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
          
          {isDetecting && detections.length > 0 && (
            <DetectionResults detections={detections} />
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveDetection;
