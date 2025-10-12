import sharp from "sharp";

export class ImageProcessor {
  constructor() {
    this.maxWidth = 1280;
    this.maxHeight = 720;
    this.quality = 85;
    this.format = "jpeg";
  }

  /**
   * Process image for optimal detection
   * @param {Buffer} imageBuffer - Original image buffer
   * @returns {Promise<Buffer>} Processed image buffer
   */
  async processImage(imageBuffer) {
    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      // Get optimal dimensions
      const { width, height } = this.calculateOptimalDimensions(
        metadata.width,
        metadata.height
      );

      // Process image
      const processedBuffer = await image
        .resize(width, height, {
          fit: "inside",
          withoutEnlargement: false,
          kernel: sharp.kernel.lanczos3,
        })
        .jpeg({
          quality: this.quality,
          progressive: true,
          mozjpeg: true,
        })
        .toBuffer();

      console.log(
        `📸 Processed image: ${metadata.width}x${metadata.height} -> ${width}x${height}`
      );

      return processedBuffer;
    } catch (error) {
      console.error("Image processing error:", error);
      throw new Error(`Failed to process image: ${error.message}`);
    }
  }

  /**
   * Calculate optimal dimensions for detection
   * @param {number} originalWidth - Original image width
   * @param {number} originalHeight - Original image height
   * @returns {Object} Optimal width and height
   */
  calculateOptimalDimensions(originalWidth, originalHeight) {
    const aspectRatio = originalWidth / originalHeight;

    let width, height;

    if (aspectRatio > this.maxWidth / this.maxHeight) {
      // Image is wider
      width = this.maxWidth;
      height = Math.round(this.maxWidth / aspectRatio);
    } else {
      // Image is taller or square
      height = this.maxHeight;
      width = Math.round(this.maxHeight * aspectRatio);
    }

    // Ensure dimensions are multiples of 32 for better model performance
    width = Math.ceil(width / 32) * 32;
    height = Math.ceil(height / 32) * 32;

    return { width, height };
  }

  /**
   * Extract frame from video data URL
   * @param {string} dataUrl - Video frame data URL
   * @returns {Promise<Buffer>} Image buffer
   */
  async extractFrameFromDataUrl(dataUrl) {
    try {
      // Remove data URL prefix
      const base64Data = dataUrl.split(",")[1];
      const buffer = Buffer.from(base64Data, "base64");

      return await this.processImage(buffer);
    } catch (error) {
      console.error("Frame extraction error:", error);
      throw new Error(`Failed to extract frame: ${error.message}`);
    }
  }

  /**
   * Validate image buffer
   * @param {Buffer} buffer - Image buffer to validate
   * @returns {Promise<boolean>} Validation result
   */
  async validateImage(buffer) {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      // Check if it's a valid image
      if (!metadata.width || !metadata.height) {
        return false;
      }

      // Check dimensions
      if (metadata.width < 32 || metadata.height < 32) {
        return false;
      }

      // Check file size (max 10MB)
      if (buffer.length > 10 * 1024 * 1024) {
        return false;
      }

      return true;
    } catch (error) {
      console.error("Image validation error:", error);
      return false;
    }
  }

  /**
   * Get image metadata
   * @param {Buffer} buffer - Image buffer
   * @returns {Promise<Object>} Image metadata
   */
  async getImageMetadata(buffer) {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: buffer.length,
        hasAlpha: metadata.hasAlpha,
        channels: metadata.channels,
        density: metadata.density,
      };
    } catch (error) {
      console.error("Metadata extraction error:", error);
      throw new Error(`Failed to extract metadata: ${error.message}`);
    }
  }

  /**
   * Create thumbnail
   * @param {Buffer} buffer - Original image buffer
   * @param {number} size - Thumbnail size
   * @returns {Promise<Buffer>} Thumbnail buffer
   */
  async createThumbnail(buffer, size = 150) {
    try {
      return await sharp(buffer)
        .resize(size, size, {
          fit: "cover",
          position: "center",
        })
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch (error) {
      console.error("Thumbnail creation error:", error);
      throw new Error(`Failed to create thumbnail: ${error.message}`);
    }
  }

  /**
   * Batch process multiple images
   * @param {Array<Buffer>} buffers - Array of image buffers
   * @returns {Promise<Array<Buffer>>} Array of processed buffers
   */
  async batchProcess(buffers) {
    try {
      const promises = buffers.map((buffer) => this.processImage(buffer));
      return await Promise.all(promises);
    } catch (error) {
      console.error("Batch processing error:", error);
      throw new Error(`Batch processing failed: ${error.message}`);
    }
  }
}

