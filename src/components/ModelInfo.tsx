import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Target, Award } from "lucide-react";

const ModelInfo = () => {
  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-border hover:border-primary/30 transition-all duration-300">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Model Information</h3>
          <Badge className="bg-primary/20 text-primary border-primary/30">
            Roboflow 3.0
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Model URL</p>
            <p className="text-sm font-mono text-foreground">internship-9cig4/1</p>
          </div>
          
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Checkpoint</p>
            <p className="text-sm font-mono text-foreground">idpr-rh5oc/2</p>
          </div>
          
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Model Type</p>
            <p className="text-sm text-foreground">Object Detection (Fast)</p>
          </div>
          
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Dataset Version</p>
            <p className="text-sm text-foreground">2025-09-01 11:16am</p>
          </div>
        </div>
        
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-semibold text-foreground mb-3">Performance Metrics</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <Target className="w-5 h-5 text-primary" />
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">45.3%</p>
                <p className="text-xs text-muted-foreground">mAP@50</p>
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-secondary/5 border border-secondary/20">
              <Award className="w-5 h-5 text-secondary" />
              <div className="text-center">
                <p className="text-2xl font-bold text-secondary">58.0%</p>
                <p className="text-xs text-muted-foreground">Precision</p>
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-accent/5 border border-accent/20">
              <Activity className="w-5 h-5 text-accent" />
              <div className="text-center">
                <p className="text-2xl font-bold text-accent">41.1%</p>
                <p className="text-xs text-muted-foreground">Recall</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="pt-2">
          <p className="text-xs text-muted-foreground">
            Updated: September 1, 2025, 2:25 AM
          </p>
        </div>
      </div>
    </Card>
  );
};

export default ModelInfo;
