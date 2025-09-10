const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();

// Cache directory for images
const CACHE_DIR = path.join(__dirname, '../cdn-cache/proxy-images');

// Ensure cache directory exists
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating cache directory:', error);
  }
}

// Initialize cache directory
ensureCacheDir();

// Helper function to extract Google Drive file ID from various URL formats
function extractGoogleDriveId(url) {
  if (!url) return null;
  
  // Handle various Google Drive URL formats
  const patterns = [
    /\/d\/([a-zA-Z0-9_-]+)/, // New format: /d/FILE_ID
    /id=([a-zA-Z0-9_-]+)/, // Query parameter format: id=FILE_ID
    /file\/d\/([a-zA-Z0-9_-]+)/, // File format: /file/d/FILE_ID
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

// Generate cache filename from URL
function getCacheFilename(url) {
  const fileId = extractGoogleDriveId(url);
  if (fileId) {
    return `gdrive_${fileId}.jpg`;
  }
  
  // Fallback for other URLs
  const hash = require('crypto').createHash('md5').update(url).digest('hex');
  return `proxy_${hash}.jpg`;
}

// Check if image is cached and not expired
async function getCachedImage(filename) {
  try {
    const cachePath = path.join(CACHE_DIR, filename);
    const stats = await fs.stat(cachePath);
    
    // Cache images for 24 hours
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const isExpired = Date.now() - stats.mtime.getTime() > maxAge;
    
    if (!isExpired) {
      return cachePath;
    } else {
      // Remove expired cache file
      await fs.unlink(cachePath).catch(() => {});
      return null;
    }
  } catch (error) {
    return null; // File doesn't exist or error reading
  }
}

// Download and cache image
async function downloadAndCacheImage(url, filename) {
  try {
    console.log(`📥 Downloading image: ${url}`);
    
    // Configure headers to avoid detection as bot
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    
    // For Google Drive, use direct download URL
    let downloadUrl = url;
    const fileId = extractGoogleDriveId(url);
    if (fileId) {
      // Use Google Drive direct download URL (better for programmatic access)
      downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
    
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'arraybuffer',
      headers,
      timeout: 30000, // 30 seconds timeout
      maxRedirects: 5,
      validateStatus: (status) => status < 400 // Accept redirects
    });
    
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const cachePath = path.join(CACHE_DIR, filename);
    await fs.writeFile(cachePath, response.data);
    
    console.log(`✅ Image cached: ${filename}`);
    return cachePath;
    
  } catch (error) {
    console.error(`❌ Error downloading image ${url}:`, error.message);
    throw error;
  }
}

// Main proxy endpoint
router.get('/image', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    // Validate URL format
    if (!url.startsWith('http')) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
    
    const filename = getCacheFilename(url);
    
    // Check if image is already cached
    let imagePath = await getCachedImage(filename);
    
    if (!imagePath) {
      // Download and cache the image
      try {
        imagePath = await downloadAndCacheImage(url, filename);
      } catch (downloadError) {
        // If download fails, try alternative Google Drive URL formats
        const fileId = extractGoogleDriveId(url);
        if (fileId) {
          const alternativeUrls = [
            `https://lh3.googleusercontent.com/d/${fileId}=w1920-h1080`,
            `https://drive.google.com/thumbnail?id=${fileId}&sz=w1920-h1080`,
            `https://drive.google.com/uc?export=view&id=${fileId}`
          ];
          
          for (const altUrl of alternativeUrls) {
            try {
              console.log(`🔄 Trying alternative URL: ${altUrl}`);
              imagePath = await downloadAndCacheImage(altUrl, filename);
              break; // Success, exit loop
            } catch (altError) {
              console.log(`❌ Alternative URL failed: ${altUrl}`);
              continue; // Try next URL
            }
          }
        }
        
        if (!imagePath) {
          return res.status(404).json({ 
            error: 'Failed to fetch image', 
            details: downloadError.message 
          });
        }
      }
    }
    
    // Set appropriate headers
    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    
    // Send the cached image
    res.sendFile(path.resolve(imagePath));
    
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

// Cache management endpoints
router.get('/cache/stats', async (req, res) => {
  try {
    const files = await fs.readdir(CACHE_DIR);
    let totalSize = 0;
    
    for (const file of files) {
      const stats = await fs.stat(path.join(CACHE_DIR, file));
      totalSize += stats.size;
    }
    
    res.json({
      totalFiles: files.length,
      totalSizeBytes: totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      cacheDir: CACHE_DIR
    });
  } catch (error) {
    res.status(500).json({ error: 'Error reading cache stats' });
  }
});

router.post('/cache/clear', async (req, res) => {
  try {
    const files = await fs.readdir(CACHE_DIR);
    let deletedCount = 0;
    
    for (const file of files) {
      await fs.unlink(path.join(CACHE_DIR, file));
      deletedCount++;
    }
    
    res.json({ message: `Cleared ${deletedCount} cached images` });
  } catch (error) {
    res.status(500).json({ error: 'Error clearing cache' });
  }
});

module.exports = router;
