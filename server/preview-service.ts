import { db } from './db';
import { content } from '@shared/schema';
import { eq } from 'drizzle-orm';
import ffmpeg from 'fluent-ffmpeg';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { path as ffprobePath } from '@ffprobe-installer/ffprobe';
import pdfThumbnail from 'pdf-thumbnail';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

// Set the paths to ffmpeg and ffprobe binaries
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

// Ensure preview directory exists
const previewsDir = path.join(process.cwd(), 'content/previews');
if (!fs.existsSync(previewsDir)) {
  fs.mkdirSync(previewsDir, { recursive: true });
}

/**
 * Service to handle content preview generation
 */
export class PreviewService {
  /**
   * Generate preview for a content item based on its type
   */
  static async generatePreview(contentId: number): Promise<string | null> {
    try {
      // Get the content item from the database
      const [contentItem] = await db
        .select()
        .from(content)
        .where(eq(content.id, contentId));

      if (!contentItem) {
        console.error(`Content not found for ID: ${contentId}`);
        return null;
      }

      // Get file path using the ContentService helper
      const { ContentService } = await import('./content-service');
      const filePath = ContentService.getFullFilePath(contentItem.url);

      // Create necessary directories
      const previewsDir = path.join(process.cwd(), 'content/previews');
      if (!fs.existsSync(previewsDir)) {
        fs.mkdirSync(previewsDir, { recursive: true });
      }
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error(`File not found at path: ${filePath}`);
        return null;
      }

      let previewUrl: string | null = null;

      // Generate preview based on content type
      switch (contentItem.type.toLowerCase()) {
        case 'video':
          previewUrl = await this.generateVideoThumbnail(filePath, contentId);
          break;
        case 'lecture handout': // PDF
          previewUrl = await this.generatePdfThumbnail(filePath, contentId);
          break;
        case 'presentation': // PPT/PPTX
          previewUrl = await this.generatePptThumbnail(filePath, contentId);
          break;
        default:
          // Generic preview for unsupported types
          previewUrl = this.generateGenericPreview(contentItem.type, contentId);
          break;
      }

      if (previewUrl) {
        // Update the content item with the preview URL
        await db
          .update(content)
          .set({ preview_url: previewUrl })
          .where(eq(content.id, contentId));
      }

      return previewUrl;
    } catch (error) {
      console.error(`Error generating preview for content ID ${contentId}:`, error);
      return null;
    }
  }

  /**
   * Generate a thumbnail for a video file
   */
  static async generateVideoThumbnail(filePath: string, contentId: number): Promise<string | null> {
    try {
      if (!fs.existsSync(filePath)) {
        console.error(`Video file not found at path: ${filePath}`);
        return this.generateGenericPreview('video', contentId);
      }

      const previewsDir = path.join(process.cwd(), 'content/previews');
      if (!fs.existsSync(previewsDir)) {
        fs.mkdirSync(previewsDir, { recursive: true });
      }

      const outputPath = path.join(previewsDir, `video_${contentId}.jpg`);
      
      return new Promise((resolve) => {
        ffmpeg(filePath)
          .screenshots({
            count: 1,
            folder: previewsDir,
            filename: `video_${contentId}.jpg`,
            size: '480x?'
          })
          .on('end', () => {
            resolve(`/content/previews/video_${contentId}.jpg`);
          })
          .on('error', (err) => {
            console.error('FFmpeg error:', err);
            resolve(this.generateGenericPreview('video', contentId));
          });
      });
    } catch (error) {
      console.error('Error in video thumbnail generation:', error);
      return this.generateGenericPreview('video', contentId);
    }
  }

  /**
   * Generate a thumbnail for a PDF file
   */
  static async generatePdfThumbnail(filePath: string, contentId: number): Promise<string | null> {
    try {
      console.log(`Generating preview for PDF: ${filePath}`);
      return this.generateGenericPreview('pdf', contentId);
    } catch (error) {
      console.error('Error generating PDF thumbnail:', error);
      return this.generateGenericPreview('pdf', contentId);
    }
  }

  static async generatePptThumbnail(filePath: string, contentId: number): Promise<string | null> {
    try {
      console.log(`Generating preview for presentation: ${filePath}`);
      return this.generateGenericPreview('presentation', contentId);
    } catch (error) {
      console.error('Error generating PPT thumbnail:', error);
      return this.generateGenericPreview('presentation', contentId);
    }
  }

  /**
   * Generate a generic preview image for unsupported file types
   */
  static generateGenericPreview(fileType: string, contentId: number): string {
    // Create previews directory if it doesn't exist
    const previewsDir = path.join(process.cwd(), 'content/previews');
    if (!fs.existsSync(previewsDir)) {
      fs.mkdirSync(previewsDir, { recursive: true });
    }

    const outputPath = path.join(previewsDir, `generic_${contentId}.svg`);
    
    // Generate a generic SVG
    const svgContent = this.getGenericPreviewSvg(fileType);
    
    // Write the SVG to file
    fs.writeFileSync(outputPath, svgContent);

    return `/content/previews/generic_${contentId}.svg`;
  }

  /**
   * Generate an SVG image for generic previews
   */
  private static getGenericPreviewSvg(fileType: string): string {
    // Get a sanitized title for the file type
    const title = fileType.charAt(0).toUpperCase() + fileType.slice(1).toLowerCase();
    
    // Pick a color based on the file type
    let color = '#3b82f6'; // Blue for default
    let icon = '';
    
    switch (fileType.toLowerCase()) {
      case 'video':
        color = '#ef4444'; // Red
        icon = '<path d="M8 5v14l11-7z" fill="white"/>';
        break;
      case 'lecture handout':
      case 'pdf':
        color = '#f97316'; // Orange
        icon = '<path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="white"/>';
        break;
      case 'presentation':
      case 'ppt':
      case 'pptx':
        color = '#ec4899'; // Pink
        icon = '<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 15H5V5h5v13zm9 0h-5V5h5v13z" fill="white"/>';
        break;
      default:
        icon = '<path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="white"/>';
        break;
    }
    
    // Create a simple SVG with a colored rectangle, icon, and text
    return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270">
      <rect width="480" height="270" fill="${color}" rx="8" ry="8"/>
      <g transform="translate(180, 95)">
        <circle cx="60" cy="40" r="40" fill="rgba(255, 255, 255, 0.2)"/>
        <g transform="translate(40, 20) scale(2)">
          ${icon}
        </g>
      </g>
      <text x="240" y="220" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle">${title}</text>
    </svg>`;
  }

  /**
   * Resize an image to maintain aspect ratio with max width
   */
  static async resizeImage(inputPath: string, outputPath: string, width: number): Promise<void> {
    try {
      await sharp(inputPath)
        .resize({ width: width, fit: 'inside' })
        .toFile(outputPath + '.tmp');
      
      // Replace the original file with the resized one
      fs.renameSync(outputPath + '.tmp', outputPath);
    } catch (error) {
      console.error('Error resizing image:', error);
      throw error;
    }
  }
}