import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import ModelInfo from "@/components/ModelInfo";
import { Sparkles, Target, Zap, Shield } from "lucide-react";

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4 animate-fade-in">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              About AI Vision
            </h1>
            <p className="text-xl text-muted-foreground">
              Powered by Roboflow 3.0 Object Detection
            </p>
          </div>
          
          <Card className="p-8 bg-card/50 backdrop-blur-sm border-border space-y-6">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-primary" />
                What is AI Vision?
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                AI Vision is a state-of-the-art object detection application that leverages the power of 
                Roboflow 3.0's fast object detection model. Our platform enables real-time and image-based 
                object detection with high accuracy and performance.
              </p>
            </div>
            
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Target className="w-6 h-6 text-secondary" />
                Model Capabilities
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                The model has been trained on a comprehensive dataset and achieves a mean Average Precision (mAP) 
                of 45.3% at IoU threshold 0.50, with 58.0% precision and 41.1% recall. This makes it suitable 
                for a wide range of object detection tasks in various environments.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4 pt-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <Zap className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-semibold text-foreground mb-2">Fast Processing</h3>
                <p className="text-sm text-muted-foreground">
                  Optimized for speed with real-time inference capabilities for live camera feeds.
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-secondary/5 border border-secondary/20">
                <Shield className="w-8 h-8 text-secondary mb-3" />
                <h3 className="font-semibold text-foreground mb-2">Reliable Detection</h3>
                <p className="text-sm text-muted-foreground">
                  High precision and recall rates ensure consistent and trustworthy object detection.
                </p>
              </div>
            </div>
          </Card>
          
          <ModelInfo />
          
          <Card className="p-6 bg-card/50 backdrop-blur-sm border-border">
            <div className="text-center space-y-2">
              <Badge className="bg-primary/20 text-primary border-primary/30">
                Powered by Roboflow
              </Badge>
              <p className="text-sm text-muted-foreground">
                This application uses Roboflow's infrastructure for model hosting and inference.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default About;
