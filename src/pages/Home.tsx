import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";
import ModelInfo from "@/components/ModelInfo";

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-24 pb-12">
        {/* Hero Section */}
        <div className="text-center space-y-6 mb-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">Powered by Roboflow 3.0</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent animate-gradient-shift bg-[length:200%_auto]">
            AI Object Detection
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Advanced real-time object detection powered by cutting-edge AI. Upload images or use your camera for instant analysis.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button
              variant="hero"
              size="lg"
              onClick={() => navigate("/upload")}
              className="min-w-[200px]"
            >
              <Upload className="w-5 h-5" />
              Upload Image
            </Button>
            
            <Button
              variant="accent"
              size="lg"
              onClick={() => navigate("/live")}
              className="min-w-[200px]"
            >
              <Camera className="w-5 h-5" />
              Live Detection
            </Button>
          </div>
        </div>
        
        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="p-6 rounded-xl bg-card/50 backdrop-blur-sm border border-border hover:border-primary/30 transition-all duration-300 hover:scale-105">
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">Image Upload</h3>
            <p className="text-sm text-muted-foreground">
              Upload any image and get instant object detection with bounding boxes and confidence scores.
            </p>
          </div>
          
          <div className="p-6 rounded-xl bg-card/50 backdrop-blur-sm border border-border hover:border-secondary/30 transition-all duration-300 hover:scale-105">
            <div className="w-12 h-12 rounded-lg bg-secondary/20 flex items-center justify-center mb-4">
              <Camera className="w-6 h-6 text-secondary" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">Live Camera</h3>
            <p className="text-sm text-muted-foreground">
              Real-time object detection using your webcam. Perfect for testing and demonstrations.
            </p>
          </div>
          
          <div className="p-6 rounded-xl bg-card/50 backdrop-blur-sm border border-border hover:border-accent/30 transition-all duration-300 hover:scale-105">
            <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">AI Powered</h3>
            <p className="text-sm text-muted-foreground">
              State-of-the-art Roboflow 3.0 model with 45.3% mAP@50 accuracy for reliable detection.
            </p>
          </div>
        </div>
        
        {/* Model Information */}
        <ModelInfo />
      </div>
    </div>
  );
};

export default Home;
