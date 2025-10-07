import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Loader2, Image as ImageIcon, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import DetectionResults from "@/components/DetectionResults";
import { useToast } from "@/hooks/use-toast";

interface Detection {
  class: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const UploadDetection = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
        setDetections([]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDetection = async () => {
    if (!selectedImage) return;

    setIsProcessing(true);
    
    // Simulate API call - replace with actual Roboflow API call
    setTimeout(() => {
      // Mock detections
      const mockDetections: Detection[] = [
        { class: "Person", confidence: 0.92, x: 100, y: 100, width: 150, height: 200 },
        { class: "Car", confidence: 0.85, x: 300, y: 200, width: 180, height: 120 },
        { class: "Bicycle", confidence: 0.78, x: 500, y: 150, width: 100, height: 120 },
      ];
      
      setDetections(mockDetections);
      drawBoundingBoxes(mockDetections);
      setIsProcessing(false);
      
      toast({
        title: "Detection Complete",
        description: `Found ${mockDetections.length} objects`,
      });
    }, 2000);
  };

  const drawBoundingBoxes = (detections: Detection[]) => {
    const canvas = canvasRef.current;
    const img = new Image();
    img.src = selectedImage!;
    
    img.onload = () => {
      if (canvas) {
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          
          detections.forEach((detection, index) => {
            const colors = ["#a855f7", "#3b82f6", "#06b6d4"];
            ctx.strokeStyle = colors[index % colors.length];
            ctx.lineWidth = 3;
            ctx.strokeRect(detection.x, detection.y, detection.width, detection.height);
            
            ctx.fillStyle = colors[index % colors.length];
            ctx.fillRect(detection.x, detection.y - 25, detection.width, 25);
            
            ctx.fillStyle = "white";
            ctx.font = "16px sans-serif";
            ctx.fillText(
              `${detection.class} ${(detection.confidence * 100).toFixed(0)}%`,
              detection.x + 5,
              detection.y - 7
            );
          });
        }
      }
    };
  };

  const handleClear = () => {
    setSelectedImage(null);
    setDetections([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center space-y-2 mb-8 animate-fade-in">
            <h1 className="text-4xl font-bold text-foreground">Image Detection</h1>
            <p className="text-muted-foreground">Upload an image to detect objects</p>
          </div>
          
          <Card className="p-8 bg-card/50 backdrop-blur-sm border-border">
            {!selectedImage ? (
              <div className="space-y-4">
                <div
                  className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-all duration-300 hover:bg-muted/20"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <p className="text-lg font-medium text-foreground mb-1">
                        Click to upload image
                      </p>
                      <p className="text-sm text-muted-foreground">
                        PNG, JPG up to 10MB
                      </p>
                    </div>
                  </div>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    className="w-full rounded-lg border border-border"
                    style={{ display: detections.length > 0 ? "block" : "none" }}
                  />
                  {detections.length === 0 && (
                    <img
                      src={selectedImage}
                      alt="Uploaded"
                      className="w-full rounded-lg border border-border"
                    />
                  )}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={handleClear}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                <Button
                  variant="hero"
                  size="lg"
                  className="w-full"
                  onClick={handleDetection}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Detect Objects
                    </>
                  )}
                </Button>
              </div>
            )}
          </Card>
          
          {detections.length > 0 && <DetectionResults detections={detections} />}
        </div>
      </div>
    </div>
  );
};

export default UploadDetection;
