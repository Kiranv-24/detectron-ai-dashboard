const API_BASE_URL = "http://localhost:3001/api";

interface DetectionResult {
  detections: Array<{
    class: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
    bbox: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    };
  }>;
  imageInfo: {
    width: number;
    height: number;
  };
  timestamp: string;
  processingTime: number;
}

export class ApiService {
  /**
   * Upload image for detection
   * @param file - Image file to analyze
   * @returns Promise with detection results
   */
  static async detectImage(file: File): Promise<DetectionResult> {
    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch(`${API_BASE_URL}/detect/image`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Detection failed");
      }

      return data;
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  }

  /**
   * Check server health
   * @returns Promise with health status
   */
  static async checkHealth(): Promise<{
    status: string;
    timestamp: string;
    version: string;
  }> {
    try {
      const response = await fetch(
        `${API_BASE_URL.replace("/api", "")}/health`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Health check failed:", error);
      throw error;
    }
  }
}
