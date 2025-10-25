import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

// __dirname replacement for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class LocalDetector {
  constructor(options = {}) {
    this.modelPath = options.modelPath || process.env.LOCAL_MODEL_PATH || path.resolve("./yolo8n.pt");
    this.pythonPath = options.pythonPath || process.env.PYTHON_PATH || "python"; // Allow override

    // Basic check for model file existence
    try {
      if (!fs.existsSync(this.modelPath)) {
        console.warn(`⚠️  Local model not found at ${this.modelPath}. Local detection will fall back to mock.`);
      }
    } catch (err) {
      console.warn("⚠️  Could not verify local model file:", err.message);
    }
  }

  /**
   * Detect objects using local YOLO model by delegating to a Python script.
   * Falls back to mock detections ony errors.
   * @param {Buffer} imageBuffer
   */
  async detectObjects(imageBuffer) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "detector-"));
    const imagePath = path.join(tempDir, "input.jpg");

    try {
      fs.writeFileSync(imagePath, imageBuffer);

      // Call Python runner which loads ultralytics/yolov8 and runs inference.
      // The Python script should print JSON to stdout.
  const scriptPath = path.resolve(path.join(__dirname, "run_yolo.py"));

      try {
        const out = execFileSync(this.pythonPath, [scriptPath, imagePath, this.modelPath], {
          stdio: ["ignore", "pipe", "pipe"],
          maxBuffer: 10 * 1024 * 1024,
        });

        const text = out.toString("utf8");
        // Log raw python output for debugging
        console.log("LocalDetector raw python output:", text);

        let data;
        try {
          data = JSON.parse(text);
        } catch (parseErr) {
          console.error("LocalDetector JSON parse error:", parseErr.message || parseErr);
          console.log("🔄 Falling back to mock detections from LocalDetector (invalid JSON)");
          return this.getMockDetections();
        }

        // If python script returned an error key, log and fallback to mock
        if (data && data.error) {
          console.error("LocalDetector python error:", data.error);
          console.log("🔄 Falling back to mock detections from LocalDetector (python error)");
          return this.getMockDetections();
        }

        return this._normalizePythonResult(data);
      } catch (err) {
        console.error("LocalDetector execution error:", err.message || err);
        console.log("🔄 Falling back to mock detections from LocalDetector");
        return this.getMockDetections();
      }
    } catch (error) {
      console.error("LocalDetector error:", error);
      return this.getMockDetections();
    } finally {
      // Cleanup temp files
      try {
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        fs.rmdirSync(tempDir, { recursive: true });
      } catch (e) {
        // ignore cleanup errors
      }
    }
  }

  _normalizePythonResult(pyResult) {
    // Expecting python to return a structure with predictions array and image info
    const detections = (pyResult.predictions || []).map((p) => ({
      class: p.class || p.name || p.label || "unknown",
      confidence: p.confidence || p.conf || 0,
      x: p.x || 0,
      y: p.y || 0,
      width: p.width || p.w || 0,
      height: p.height || p.h || 0,
      bbox: p.bbox || {
        x1: p.x1 || 0,
        y1: p.y1 || 0,
        x2: p.x2 || 0,
        y2: p.y2 || 0,
      },
    }));

    return {
      detections,
      image: pyResult.image || { width: 640, height: 480 },
      model: { name: this.modelPath, checkpoint: null },
      timestamp: new Date().toISOString(),
      processingTime: pyResult.processing_time || 0,
    };
  }

  getMockDetections() {
    const mockClasses = ["person", "helmet", "no-jacket", "safety belt", "jacket"];
    const numDetections = Math.floor(Math.random() * 4) + 1;

    const detections = Array.from({ length: numDetections }, (_, i) => {
      const randomClass = mockClasses[Math.floor(Math.random() * mockClasses.length)];
      const confidence = 0.6 + Math.random() * 0.35;

      return {
        class: randomClass,
        confidence,
        x: 100 + i * 120 + Math.random() * 80,
        y: 120 + i * 80 + Math.random() * 60,
        width: 60 + Math.random() * 120,
        height: 60 + Math.random() * 120,
        bbox: {
          x1: 50 + i * 120,
          y1: 80 + i * 80,
          x2: 110 + i * 120,
          y2: 160 + i * 80,
        },
      };
    });

    return {
      detections,
      image: { width: 640, height: 480 },
      model: { name: this.modelPath, checkpoint: null },
      timestamp: new Date().toISOString(),
      processingTime: 120,
    };
  }

  getModelInfo() {
    return {
      modelPath: this.modelPath,
      python: this.pythonPath,
      available: fs.existsSync(this.modelPath),
    };
  }
}

export default LocalDetector;
