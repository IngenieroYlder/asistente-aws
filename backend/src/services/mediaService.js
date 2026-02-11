/**
 * mediaService.js - Centralized Media Optimization Pipeline
 * 
 * Accepts files up to 25MB raw, compresses them intelligently:
 * - Images: Convert to WebP (90% smaller), resize if needed, maintain quality
 * - Audio: Convert to OGG/Opus (smaller than MP3), good voice quality
 * 
 * Usage:
 *   const { optimizeImage, optimizeAudio, getOptimizedPath } = require('./mediaService');
 *   const result = await optimizeImage(inputPath, { maxWidth: 1200, quality: 80 });
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// ========== IMAGE OPTIMIZATION ==========

/**
 * Smart image optimizer. Converts to WebP for massive size savings.
 * Falls back to JPEG if WebP fails.
 * 
 * @param {string} inputPath - Absolute path to the input image
 * @param {Object} options
 * @param {number} options.maxWidth - Max width in pixels (default: 1600)
 * @param {number} options.quality - Quality 1-100 (default: 82)
 * @param {boolean} options.forceWebP - Convert to WebP (default: true)
 * @returns {Object} { outputPath, originalSize, optimizedSize, savings, format }
 */
async function optimizeImage(inputPath, options = {}) {
    const {
        maxWidth = 1600,
        quality = 82,
        forceWebP = true
    } = options;

    const originalStats = fs.statSync(inputPath);
    const originalSize = originalStats.size;
    const ext = forceWebP ? '.webp' : path.extname(inputPath);
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const outputPath = path.join(path.dirname(inputPath), `${baseName}_opt${ext}`);

    try {
        let pipeline = sharp(inputPath)
            .resize({ 
                width: maxWidth, 
                withoutEnlargement: true,
                fit: 'inside' // Mantener proporción
            })
            .rotate(); // Auto-rotate based on EXIF

        if (forceWebP) {
            pipeline = pipeline.webp({ 
                quality, 
                effort: 4,       // Balance speed/compression (0=fast, 6=slow)
                smartSubsample: true 
            });
        } else {
            pipeline = pipeline.jpeg({ 
                quality, 
                progressive: true,
                mozjpeg: true    // Better compression algorithm
            });
        }

        await pipeline.toFile(outputPath);
        
        const optimizedStats = fs.statSync(outputPath);
        const optimizedSize = optimizedStats.size;
        const savings = ((1 - optimizedSize / originalSize) * 100).toFixed(1);

        // Only use optimized version if it's actually smaller
        if (optimizedSize < originalSize) {
            fs.unlinkSync(inputPath); // Remove original
            const finalPath = inputPath.replace(path.extname(inputPath), ext);
            fs.renameSync(outputPath, finalPath);
            
            console.log(`[MediaService] Image: ${(originalSize/1024).toFixed(0)}KB → ${(optimizedSize/1024).toFixed(0)}KB (-${savings}%) [${forceWebP ? 'WebP' : 'JPEG'}]`);
            
            return {
                outputPath: finalPath,
                filename: path.basename(finalPath),
                originalSize,
                optimizedSize,
                savings: `${savings}%`,
                format: forceWebP ? 'webp' : 'jpeg'
            };
        } else {
            // Original is already small, don't bother
            try { fs.unlinkSync(outputPath); } catch(e) {}
            console.log(`[MediaService] Image already optimal (${(originalSize/1024).toFixed(0)}KB). Skipping.`);
            return {
                outputPath: inputPath,
                filename: path.basename(inputPath),
                originalSize,
                optimizedSize: originalSize,
                savings: '0%',
                format: path.extname(inputPath).slice(1)
            };
        }
    } catch (error) {
        console.error('[MediaService] Image optimization failed:', error.message);
        // On failure, keep original
        try { fs.unlinkSync(outputPath); } catch(e) {}
        return {
            outputPath: inputPath,
            filename: path.basename(inputPath),
            originalSize,
            optimizedSize: originalSize,
            savings: '0%',
            format: path.extname(inputPath).slice(1),
            error: error.message
        };
    }
}

// ========== AUDIO OPTIMIZATION ==========

/**
 * Audio optimizer. Converts to OGG/Opus for smaller size with good voice quality.
 * Requires ffmpeg installed on the system.
 * 
 * @param {string} inputPath - Absolute path to the input audio
 * @param {Object} options
 * @param {number} options.bitrate - Target bitrate in kbps (default: 64 for voice)
 * @param {number} options.sampleRate - Sample rate (default: 48000)
 * @returns {Object} { outputPath, originalSize, optimizedSize, savings, format }
 */
async function optimizeAudio(inputPath, options = {}) {
    const {
        bitrate = 64,       // 64kbps is excellent for voice, 128 for music
        sampleRate = 48000
    } = options;

    const originalStats = fs.statSync(inputPath);
    const originalSize = originalStats.size;
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const outputPath = path.join(path.dirname(inputPath), `${baseName}_opt.ogg`);

    try {
        const ffmpeg = require('fluent-ffmpeg');
        
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .audioCodec('libopus')
                .audioBitrate(bitrate)
                .audioFrequency(sampleRate)
                .audioChannels(1) // Mono for voice (halves size)
                .format('ogg')
                .on('end', resolve)
                .on('error', reject)
                .save(outputPath);
        });

        const optimizedStats = fs.statSync(outputPath);
        const optimizedSize = optimizedStats.size;
        const savings = ((1 - optimizedSize / originalSize) * 100).toFixed(1);

        if (optimizedSize < originalSize) {
            fs.unlinkSync(inputPath);
            const finalPath = inputPath.replace(path.extname(inputPath), '.ogg');
            fs.renameSync(outputPath, finalPath);

            console.log(`[MediaService] Audio: ${(originalSize/1024).toFixed(0)}KB → ${(optimizedSize/1024).toFixed(0)}KB (-${savings}%) [OGG/Opus@${bitrate}kbps]`);
            
            return {
                outputPath: finalPath,
                filename: path.basename(finalPath),
                originalSize,
                optimizedSize,
                savings: `${savings}%`,
                format: 'ogg'
            };
        } else {
            try { fs.unlinkSync(outputPath); } catch(e) {}
            return {
                outputPath: inputPath,
                filename: path.basename(inputPath),
                originalSize,
                optimizedSize: originalSize,
                savings: '0%',
                format: path.extname(inputPath).slice(1)
            };
        }
    } catch (error) {
        console.error('[MediaService] Audio optimization failed:', error.message);
        try { fs.unlinkSync(outputPath); } catch(e) {}
        return {
            outputPath: inputPath,
            filename: path.basename(inputPath),
            originalSize,
            optimizedSize: originalSize,
            savings: '0%',
            format: path.extname(inputPath).slice(1),
            error: error.message
        };
    }
}

// ========== UNIVERSAL OPTIMIZER ==========

/**
 * Auto-detect file type and optimize accordingly.
 * @param {string} filePath - Absolute path to the file
 * @param {string} type - 'image' or 'audio'
 * @param {Object} options - Optimization options
 * @returns {Object} Optimization result
 */
async function optimizeFile(filePath, type, options = {}) {
    if (type === 'image') {
        return optimizeImage(filePath, options);
    } else if (type === 'audio') {
        return optimizeAudio(filePath, options);
    }
    // Unknown type, return as-is
    return { 
        outputPath: filePath, 
        filename: path.basename(filePath),
        originalSize: fs.statSync(filePath).size,
        optimizedSize: fs.statSync(filePath).size,
        savings: '0%',
        format: path.extname(filePath).slice(1)
    };
}

module.exports = {
    optimizeImage,
    optimizeAudio,
    optimizeFile,
    UPLOADS_DIR
};
