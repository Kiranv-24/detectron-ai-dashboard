import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export interface Violation {
  type: string;
  confidence: number;
  timestamp: number;
  frame: number;
}

interface VideoAnalysisResultsProps {
  violations: Violation[];
  duration: number;
}

const VideoAnalysisResults = ({ violations, duration }: VideoAnalysisResultsProps) => {
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  // Group violations by type
  const violationsByType = violations.reduce((acc, violation) => {
    acc[violation.type] = (acc[violation.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="p-6 bg-card/50 backdrop-blur-sm border-border">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {violations.length > 0 ? (
              <AlertCircle className="w-5 h-5 text-destructive" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            )}
            <h3 className="text-lg font-semibold text-foreground">
              PPE Violations Summary
            </h3>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <p className="text-sm text-muted-foreground">Total Violations</p>
              <p className="text-2xl font-bold text-foreground">{violations.length}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <p className="text-sm text-muted-foreground">Video Duration</p>
              <p className="text-2xl font-bold text-foreground">{formatTime(duration)}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <p className="text-sm text-muted-foreground">Violation Types</p>
              <p className="text-2xl font-bold text-foreground">{Object.keys(violationsByType).length}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <p className="text-sm text-muted-foreground">Avg. Confidence</p>
              <p className="text-2xl font-bold text-foreground">
                {violations.length > 0
                  ? `${(violations.reduce((sum, v) => sum + v.confidence, 0) / violations.length * 100).toFixed(1)}%`
                  : "N/A"}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Violations Timeline */}
      {violations.length > 0 && (
        <Card className="p-6 bg-card/50 backdrop-blur-sm border-border">
          <div className="space-y-4">
            <h4 className="font-medium text-foreground">Violations Timeline</h4>
            <div className="space-y-2">
              {violations.map((violation, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border hover:border-destructive/30 transition-all duration-300"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                    <div>
                      <span className="font-medium text-foreground">{violation.type}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        at {formatTime(violation.timestamp)}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                    {(violation.confidence * 100).toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Violation Types Breakdown */}
      {Object.keys(violationsByType).length > 0 && (
        <Card className="p-6 bg-card/50 backdrop-blur-sm border-border">
          <div className="space-y-4">
            <h4 className="font-medium text-foreground">Violation Types</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(violationsByType).map(([type, count]) => (
                <div
                  key={type}
                  className="p-4 rounded-lg bg-muted/30 border border-border"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{type}</span>
                    <Badge className="bg-destructive/20 text-destructive border-destructive/30">
                      {count} violations
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default VideoAnalysisResults;