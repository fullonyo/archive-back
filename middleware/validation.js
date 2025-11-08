const Joi = require('joi');

// Validation schemas
const schemas = {
  register: Joi.object({
    username: Joi.string()
      .pattern(/^[a-zA-Z0-9_]+$/)
      .min(3)
      .max(30)
      .required()
      .messages({
        'string.pattern.base': 'Username must contain only letters, numbers, and underscores',
        'string.min': 'Username must be at least 3 characters long',
        'string.max': 'Username cannot exceed 30 characters',
        'any.required': 'Username is required'
      }),
    
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    
    password: Joi.string()
      .min(6)
      .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])'))
      .required()
      .messages({
        'string.min': 'Password must be at least 6 characters long',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
        'any.required': 'Password is required'
      })
  }),

  login: Joi.object({
    email: Joi.string()
      .email()
      .messages({
        'string.email': 'Please provide a valid email address'
      }),
    
    username: Joi.string()
      .pattern(/^[a-zA-Z0-9_]+$/)
      .min(3)
      .max(30)
      .messages({
        'string.pattern.base': 'Username must contain only letters, numbers, and underscores',
        'string.min': 'Username must be at least 3 characters',
        'string.max': 'Username cannot exceed 30 characters'
      }),
    
    password: Joi.string()
      .required()
      .messages({
        'any.required': 'Password is required'
      })
  }).or('email', 'username'), // Pelo menos um dos dois é obrigatório

  updateProfile: Joi.object({
    username: Joi.string()
      .pattern(/^[a-zA-Z0-9_]+$/)
      .min(3)
      .max(30)
      .optional()
      .messages({
        'string.pattern.base': 'Username must contain only letters, numbers, and underscores'
      }),
    
    bio: Joi.string()
      .max(500)
      .optional()
      .allow(''),
    
    country: Joi.string()
      .max(100)
      .optional()
      .allow(''),
    
    city: Joi.string()
      .max(100)
      .optional()
      .allow(''),
    
    avatar_url: Joi.string()
      .uri()
      .optional()
      .allow(''),
    
    // Aceitar tanto 'social' quanto 'socialLinks' para compatibilidade
    social: Joi.object({
      discord: Joi.string()
        .max(100)
        .optional()
        .allow(''),
      
      twitter: Joi.string()
        .max(100)
        .optional()
        .allow(''),
      
      instagram: Joi.string()
        .max(100)
        .optional()
        .allow(''),
      
      youtube: Joi.string()
        .max(100)
        .optional()
        .allow(''),
      
      spotify: Joi.string()
        .max(200)
        .optional()
        .allow(''),
      
      vrchat: Joi.string()
        .max(100)
        .optional()
        .allow('')
    }).optional(),
    
    socialLinks: Joi.object({
      discord: Joi.string()
        .max(100)
        .optional()
        .allow(''),
      
      twitter: Joi.string()
        .max(100)
        .optional()
        .allow(''),
      
      instagram: Joi.string()
        .max(100)
        .optional()
        .allow(''),
      
      youtube: Joi.string()
        .max(100)
        .optional()
        .allow(''),
      
      spotify: Joi.string()
        .max(200)
        .optional()
        .allow(''),
      
      vrchat: Joi.string()
        .max(100)
        .optional()
        .allow('')
    }).optional()
  }),

  uploadAsset: Joi.object({
    title: Joi.string()
      .min(3)
      .max(200)
      .required()
      .messages({
        'string.min': 'Title must be at least 3 characters long',
        'string.max': 'Title cannot exceed 200 characters',
        'any.required': 'Title is required'
      }),
    
    description: Joi.string()
      .max(10000) // Aumentado de 2000 para 10000 caracteres para descrições mais detalhadas
      .optional()
      .allow(''),
    
    category_id: Joi.number()
      .integer()
      .positive()
      .required()
      .messages({
        'number.base': 'Category must be a number',
        'number.integer': 'Category must be an integer',
        'number.positive': 'Category must be positive',
        'any.required': 'Category is required'
      }),
    
    external_url: Joi.string()
      .uri()
      .max(1000)
      .optional()
      .allow('')
      .messages({
        'string.uri': 'External URL must be a valid URL',
        'string.max': 'External URL cannot exceed 1000 characters'
      }),
    
    tags: Joi.array()
      .items(Joi.string().max(50))
      .max(10)
      .optional(),
      
    // Add support for image count (we'll receive files separately in req.files)
    imageCount: Joi.number()
      .integer()
      .min(0)
      .max(5)
      .optional()
  }),

  reviewAsset: Joi.object({
    rating: Joi.number()
      .integer()
      .min(1)
      .max(5)
      .required()
      .messages({
        'number.min': 'Rating must be between 1 and 5',
        'number.max': 'Rating must be between 1 and 5',
        'any.required': 'Rating is required'
      }),
    
    comment: Joi.string()
      .max(1000)
      .optional()
      .allow('')
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string()
      .required()
      .messages({
        'any.required': 'Current password is required'
      }),
    
    newPassword: Joi.string()
      .min(6)
      .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])'))
      .required()
      .messages({
        'string.min': 'New password must be at least 6 characters long',
        'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, and one number',
        'any.required': 'New password is required'
      })
  })
};

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    console.log('=== VALIDATION ===');
    console.log('Original body:', req.body);
    
    // Process tags field if it comes as array from FormData
    if (req.body.tags && Array.isArray(req.body.tags)) {
      // Already an array, keep as is
      console.log('Tags received as array:', req.body.tags);
    } else if (req.body.tags) {
      // Convert single string to array
      req.body.tags = [req.body.tags];
      console.log('Tags converted to array:', req.body.tags);
    } else {
      // No tags provided
      req.body.tags = [];
    }
    
    console.log('Processed body for validation:', req.body);
    
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      console.log('Validation errors:', error.details);
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }

    console.log('Validation passed');
    next();
  };
};

// File validation middleware
const validateFile = (options = {}) => {
  const {
    allowedTypes = ['image/jpeg', 'image/png', 'application/zip'],
    maxSize = 50 * 1024 * 1024, // 50MB
    required = true
  } = options;

  return (req, res, next) => {
    if (!req.file && required) {
      return res.status(400).json({
        success: false,
        message: 'File is required'
      });
    }

    if (req.file) {
      // Check file type
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
        });
      }

      // Check file size
      if (req.file.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: `File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`
        });
      }
    }

    next();
  };
};

// Query parameter validation
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Query validation failed',
        errors: errors
      });
    }

    next();
  };
};

// Common query schemas
const querySchemas = {
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().valid('newest', 'oldest', 'popular', 'rating', 'downloads', 'name').default('newest')
  }),

  search: Joi.object({
    q: Joi.string().max(100).optional(),
    category: Joi.number().integer().positive().optional(),
    tags: Joi.string().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().valid('newest', 'oldest', 'popular', 'rating', 'downloads', 'name').default('newest')
  })
};

module.exports = {
  validate,
  validateFile,
  validateQuery,
  schemas,
  querySchemas
}; 