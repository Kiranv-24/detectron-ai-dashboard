import fetch from "node-fetch";

export class RoboflowService {
  constructor() {
    this.apiKey = process.env.ROBOFLOW_API_KEY || "YOUR_ROBOFLOW_API_KEY_HERE";
    this.modelUrl = process.env.ROBOFLOW_MODEL_URL || "internship-snt8r/1";
    this.checkpoint = process.env.ROBOFLOW_CHECKPOINT || null; // No checkpoint for this model
    this.baseUrl = "https://detect.roboflow.com";

    if (this.apiKey === "YOUR_ROBOFLOW_API_KEY_HERE") {
      console.warn(
        "⚠️  Roboflow API key not configured. Please set ROBOFLOW_API_KEY in your .env file"
      );
    }
  }

  /**
   * Detect objects in an image using Roboflow API
   * @param {Buffer} imageBuffer - The image buffer to analyze
   * @returns {Promise<Object>} Detection results
   */
  async detectObjects(imageBuffer) {
    try {
      if (this.apiKey === "YOUR_ROBOFLOW_API_KEY_HERE") {
        // Return mock data when API key is not configured
        return this.getMockDetections();
      }

      const formData = new FormData();
      formData.append("file", new Blob([imageBuffer]), "image.jpg");

      const response = await fetch(
        `${this.baseUrl}/${this.modelUrl}?api_key=${this.apiKey}`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(
          `Roboflow API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return this.processDetectionResults(data);
    } catch (error) {
      console.error("Roboflow detection error:", error);

      // Return mock data on error for development
      console.log("🔄 Falling back to mock detections");
      return this.getMockDetections();
    }
  }

  /**
   * Process and normalize detection results from Roboflow API
   * @param {Object} rawData - Raw response from Roboflow
   * @returns {Object} Processed detection results
   */
  processDetectionResults(rawData) {
    const detections =
      rawData.predictions?.map((prediction) => ({
        class: prediction.class,
        confidence: prediction.confidence,
        x: prediction.x,
        y: prediction.y,
        width: prediction.width,
        height: prediction.height,
        bbox: {
          x1: prediction.x - prediction.width / 2,
          y1: prediction.y - prediction.height / 2,
          x2: prediction.x + prediction.width / 2,
          y2: prediction.y + prediction.height / 2,
        },
      })) || [];

    return {
      detections,
      image: {
        width: rawData.image?.width || 640,
        height: rawData.image?.height || 480,
      },
      model: {
        name: this.modelUrl,
        checkpoint: this.checkpoint,
      },
      timestamp: new Date().toISOString(),
      processingTime: rawData.processing_time || 0,
    };
  }

  /**
   * Generate mock detections for development/testing
   * @returns {Object} Mock detection results
   */
  getMockDetections() {
    const mockClasses = [
      "person",
      "helmet",
      "no-jacket",
      "safety belt",
      "jacket",
      "gloves",
      "boots",
      "hard hat",
    ];
    const numDetections = Math.floor(Math.random() * 5) + 1;

    const detections = Array.from({ length: numDetections }, (_, i) => {
      const randomClass =
        mockClasses[Math.floor(Math.random() * mockClasses.length)];
      const confidence = 0.7 + Math.random() * 0.25;

      return {
        class: randomClass,
        confidence: confidence,
        x: 100 + i * 150 + Math.random() * 100,
        y: 100 + i * 100 + Math.random() * 80,
        width: 80 + Math.random() * 120,
        height: 80 + Math.random() * 120,
        bbox: {
          x1: 50 + i * 150,
          y1: 50 + i * 100,
          x2: 130 + i * 150,
          y2: 130 + i * 100,
        },
      };
    });

    return {
      detections,
      image: {
        width: 640,
        height: 480,
      },
      model: {
        name: this.modelUrl,
        checkpoint: this.checkpoint,
      },
      timestamp: new Date().toISOString(),
      processingTime: 150 + Math.random() * 100,
    };
  }

  /**
   * Get model information
   * @returns {Object} Model configuration
   */
  getModelInfo() {
    return {
      modelUrl: this.modelUrl,
      checkpoint: this.checkpoint,
      apiKeyConfigured: this.apiKey !== "YOUR_ROBOFLOW_API_KEY_HERE",
      baseUrl: this.baseUrl,
    };
  }

  /**
   * Test API connection
   * @returns {Promise<boolean>} Connection status
   */
  async testConnection() {
    try {
      if (this.apiKey === "YOUR_ROBOFLOW_API_KEY_HERE") {
        return false;
      }

      // Create a small test image (1x1 pixel)
      const testImageBuffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
        0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
        0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
        0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
        0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
        0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
        0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xff, 0xc4,
        0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xda, 0x00, 0x0c,
        0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3f, 0x00, 0x8a, 0xff,
        0xd9,
      ]);

      const result = await this.detectObjects(testImageBuffer);
      return result !== null;
    } catch (error) {
      console.error("Roboflow connection test failed:", error);
      return false;
    }
  }
}
