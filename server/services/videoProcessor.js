import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class VideoProcessor {
  constructor() {
    this.framesDir = path.join(__dirname, "../uploads/frames");
    this.ffmpegPath =
      "C:\\Users\\91935\\Downloads\\ffmpeg-7.1.1-essentials_build\\ffmpeg-7.1.1-essentials_build\\bin\\ffmpeg.exe";
    this.ffprobePath =
      "C:\\Users\\91935\\Downloads\\ffmpeg-7.1.1-essentials_build\\ffmpeg-7.1.1-essentials_build\\bin\\ffprobe.exe";
    this.ensureFramesDirectory();
  }

  ensureFramesDirectory() {
    if (!fs.existsSync(this.framesDir)) {
      fs.mkdirSync(this.framesDir, { recursive: true });
      console.log(`📁 Created frames directory: ${this.framesDir}`);
    }
  }

  /**
   * Get video metadata (duration, dimensions)
   * @param {string} videoPath - Path to video file
   * @returns {Promise<Object>} Video metadata
   */
  async getMetadata(videoPath) {
    try {
      // Use ffprobe to get video metadata
      const { stdout } = await execAsync(
        `"${this.ffprobePath}" -v error -select_streams v:0 -show_entries stream=width,height,duration -of json "${videoPath}"`
      );

      const data = JSON.parse(stdout);
      const stream = data.streams[0];

      if (!stream) {
        throw new Error("Could not extract video metadata");
      }

      return {
        duration: parseFloat(stream.duration) * 1000, // Convert to milliseconds
        width: stream.width,
        height: stream.height,
      };
    } catch (error) {
      console.error("Metadata extraction error:", error);
      throw error;
    }
  }

  /**
   * Extract frames from video file at specified FPS
   * @param {string} videoPath - Path to video file
   * @param {number} fps - Frames per second to extract
   * @returns {Promise<Array>} Array of frame paths
   */
  async extractFrames(videoPath, fps = 1) {
    try {
      const outputPattern = path.join(this.framesDir, `frame_%d.jpg`);
      const frameTimestampFile = path.join(this.framesDir, "timestamps.json");

      // Extract frames with timestamps
      await execAsync(
        `"${this.ffmpegPath}" -i "${videoPath}" -vf fps=${fps} "${outputPattern}" -hide_banner`
      );

      // Get frame timestamps
      const { stdout } = await execAsync(
        `"${this.ffprobePath}" -v error -show_entries frame=pkt_pts_time -of csv=p=0 "${videoPath}"`
      );

      const timestamps = stdout
        .split("\n")
        .filter((line) => line.trim())
        .map((time) => Math.round(parseFloat(time) * 1000)); // Convert to milliseconds

      // Save timestamps
      fs.writeFileSync(frameTimestampFile, JSON.stringify(timestamps));

      // Get list of extracted frames
      const frames = fs
        .readdirSync(this.framesDir)
        .filter((file) => file.startsWith("frame_") && file.endsWith(".jpg"))
        .sort((a, b) => {
          const numA = parseInt(a.match(/\d+/)[0]);
          const numB = parseInt(b.match(/\d+/)[0]);
          return numA - numB;
        })
        .map((file) => path.join(this.framesDir, file));

      return frames;
    } catch (error) {
      console.error("Frame extraction error:", error);
      throw error;
    }
  }

  /**
   * Read frame buffer from file
   * @param {string} framePath - Path to frame file
   * @returns {Promise<Buffer>} Frame buffer
   */
  async readFrame(framePath) {
    return fs.promises.readFile(framePath);
  }

  /**
   * Clean up extracted frames
   */
  async cleanup() {
    try {
      const files = fs.readdirSync(this.framesDir);
      for (const file of files) {
        if (file.startsWith("frame_") || file === "timestamps.json") {
          fs.unlinkSync(path.join(this.framesDir, file));
        }
      }
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  }

  /**
   * Process video and extract frames with their timestamps
   * @param {string} videoPath - Path to video file
   * @param {number} fps - Frames per second to extract
   * @param {Function} processCallback - Callback to process each frame with timestamp
   * @returns {Promise<Object>} Video metadata and frame data
   */
  async processVideo(videoPath, fps = 1, processCallback) {
    try {
      // Get video metadata
      const metadata = await this.getMetadata(videoPath);

      // Extract frames
      const framePaths = await this.extractFrames(videoPath, fps);

      const frames = [];
      for (let i = 0; i < framePaths.length; i++) {
        const framePath = framePaths[i];
        const frameBuffer = await this.readFrame(framePath);
        const timestamp = i * (1000 / fps); // Approximate timestamp
        const metadata = await sharp(frameBuffer).metadata();

        const frameData = {
          buffer: frameBuffer,
          timestamp,
          frameNumber: i,
          width: metadata.width,
          height: metadata.height,
        };

        frames.push(frameData);

        // Process frame with callback if provided
        if (processCallback) {
          await processCallback(frameData);
        }
      }

      return {
        metadata,
        frames,
        frameCount: frames.length,
      };
    } catch (error) {
      console.error("Video processing error:", error);
      throw error;
    } finally {
      // Cleanup extracted frames
      await this.cleanup();
    }
  }
}

export default VideoProcessor;
