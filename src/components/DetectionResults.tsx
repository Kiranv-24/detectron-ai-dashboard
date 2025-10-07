import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

interface Detection {
  class: string;
  confidence: number;
}

interface DetectionResultsProps {
  detections: Detection[];
}

const DetectionResults = ({ detections }: DetectionResultsProps) => {
  if (detections.length === 0) {
    return null;
  }

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-border animate-fade-in">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-accent" />
          <h3 className="text-lg font-semibold text-foreground">
            Detected Objects ({detections.length})
          </h3>
        </div>
        
        <div className="space-y-2">
          {detections.map((detection, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/30 transition-all duration-300"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-accent animate-glow-pulse" />
                <span className="font-medium text-foreground">{detection.class}</span>
              </div>
              <Badge className="bg-primary/20 text-primary border-primary/30">
                {(detection.confidence * 100).toFixed(1)}%
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default DetectionResults;
