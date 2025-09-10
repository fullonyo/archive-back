const multer = require('multer');
const path = require('path');

// Configure storage (memory storage for Google Drive upload)
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  // Different validation based on field name
  if (file.fieldname === 'file') {
    // Main asset file - ZIP, Unity Package, etc.
    const allowedAssetTypes = [
      'application/zip',
      'application/x-zip-compressed',
      'application/octet-stream',
      'application/x-unity-package',
      'application/vnd.rar',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'application/x-tar',
      'application/gzip'
    ];
    
    if (allowedAssetTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Asset file type ${file.mimetype} not allowed. Must be .zip, .unitypackage, .rar, .7z, etc.`), false);
    }
  } else if (file.fieldname === 'images') {
    // Image files - PNG, JPG, GIF, WebP
    const allowedImageTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp'
    ];
    
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Image file type ${file.mimetype} not allowed. Must be .png, .jpg, .gif, or .webp`), false);
    }
  } else {
    cb(new Error(`Unexpected field: ${file.fieldname}`), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 1073741824, // 1GB default
    files: 6, // 1 main file + 5 images
    parts: 20, // Additional form fields
    fieldSize: 2 * 1024 * 1024 // 2MB for text fields
  }
});

// Upload configurations for different routes
const uploadConfigs = {
  // Asset upload with file and multiple images (use .any() to avoid field limits)
  asset: upload.any(),
  
  // Single file upload for assets (legacy)
  assetSingle: upload.single('file'),
  
  // Avatar upload (smaller size limit)
  avatar: multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Avatar must be an image file. Allowed types: ${allowedTypes.join(', ')}`), false);
      }
    },
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB for avatars
      files: 1
    }
  }).single('avatar'),

  // Banner upload (larger size limit for banners)
  banner: multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Banner must be an image file. Allowed types: ${allowedTypes.join(', ')}`), false);
      }
    },
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB for banners (larger than avatars)
      files: 1
    }
  }).single('banner'),

  // Multiple files upload (for future use)
  multiple: upload.array('files', 5)
};

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  console.log('=== MULTER ERROR HANDLER ===');
  console.log('Error:', err);
  console.log('Error message:', err.message);
  console.log('Files received:', req.files);
  console.log('Body received:', req.body);
  
  if (err instanceof multer.MulterError) {
    console.log('Multer error type:', err.code);
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          message: 'File too large',
          maxSize: `1GB`
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: `Too many files uploaded. Maximum: 1 main file + 5 images`,
          details: err.message
        });
      case 'LIMIT_FILES':
        return res.status(400).json({
          success: false,
          message: `Too many files uploaded. Maximum: 6 files total`,
          details: err.message
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: 'Unexpected field name for file upload. Expected: "file" or "images"',
          details: err.message
        });
      default:
        return res.status(400).json({
          success: false,
          message: 'File upload error',
          error: err.message,
          code: err.code
        });
    }
  }
  
  // Handle custom file filter errors
  if (err.message.includes('not allowed') || err.message.includes('must be an image') || err.message.includes('Unexpected field')) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  
  console.log('Passing error to next middleware');
  next(err);
};

module.exports = {
  upload,
  uploadConfigs,
  handleMulterError
}; 