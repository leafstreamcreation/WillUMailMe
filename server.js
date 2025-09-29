require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const helmet = require('helmet');
const cors = require('cors');
const { SubtleCrypto } = require('crypto').webcrypto;

// Environment variables validation
const requiredEnvVars = [
  'CLIENT_KEY', 
  'HOST_DOMAIN',
  'HOST_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'API_KEY_SECRET',
  'API_KEY_CIPHER',
  'GCM_TAG_LENGTH',
  'PBKDF2_ITERATIONS',
  'API_KEY_IV_LENGTH',
  'API_KEY_SALT_LENGTH'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

function isAPIKey(key) {
  return typeof key === 'string' && key.trim().length === (parseInt(process.env.API_KEY_IV_LENGTH) + parseInt(process.env.API_KEY_SALT_LENGTH) + process.env.API_KEY_CIPHER.length);
}

const app = express();

// Security middleware
app.use(helmet());
// Enable CORS for all origins
app.use(cors());

// Middleware to parse JSON and validate content-type
app.use('/send', (req, res, next) => {
  if (req.get('Content-Type') !== 'application/json') {
    return res.status(400).json({ 
      error: 'Content-Type must be application/json' 
    });
  }
  next();
});

app.use(express.json({ limit: '1mb' }));

app.locals.transporter = nodemailer.createTransport({
    host: process.env.HOST_DOMAIN,
    port: process.env.HOST_PORT, // Standard SMTP port for TLS
    secure: false, // Use TLS
    auth: {
      user: process.env.SMTP_USER, // Use SMTP_USER for authentication
      pass: process.env.SMTP_PASSWORD
    },
    disableFileAccess: true, // Disable file access for security
});

// API key authentication middleware
const authenticateApiKey = async (req, res, next) => {
  const base64Cipher = req.get('X-API-Key');
  const fullCipher = Buffer.from(base64Cipher, 'base64');

  if (!isAPIKey(fullCipher)) {
    return res.status(400).json({
      error: 'Bad Request'
    });
  }
  const cipherTextEnd = process.env.API_KEY_CIPHER.length;
  const ivEnd = process.env.API_KEY_IV_LENGTH + cipherTextEnd;
  const saltEnd = process.env.API_KEY_SALT_LENGTH + ivEnd;
  const cipherText = Buffer.from(fullCipher.slice(0, cipherTextEnd));
  const iv = Buffer.from(fullCipher.slice(cipherTextEnd, ivEnd));
  const salt = Buffer.from(fullCipher.slice(ivEnd, saltEnd));

  //TODO: decrypt inbound api key; api keys are aes-256-gcm encrypted in transit, so we need to decrypt them before comparison.
  const baseKey = await SubtleCrypto.importKey(
    'raw',
    process.env.API_KEY_SECRET,
    {
      name: 'PBKDF2'
    },
    false,
    ['deriveKey']
  );

  const key = await SubtleCrypto.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: process.env.PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decryptedApiKey = await SubtleCrypto.decrypt({
    name: 'AES-GCM',
    iv,
    tagLength: process.env.GCM_TAG_LENGTH
  },
    key,
    cipherText
  ).then(decrypted => new TextDecoder().decode(decrypted));

  if (decryptedApiKey !== process.env.API_KEY_CIPHER) {
    return res.status(403).json({ 
      error: 'Invalid API key' 
    });
  }
  
  next();
};
// Input validation function
const validateEmailInput = (data) => {
  const errors = [];
  
  if (!data.senderEmail || typeof data.senderEmail !== 'string') {
    errors.push('senderEmail is required and must be a string');
  } else {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.senderEmail)) {
      errors.push('senderEmail must be a valid email address');
    }
  }

  if (!data.destination || typeof data.destination !== 'string') {
    errors.push('destination is required and must be a string');
  } else {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.destination)) {
      errors.push('destination must be a valid email address');
    }
  }

  if (data.replyTo && typeof data.replyTo !== 'string') {
    errors.push('replyTo must be a string');
  } else if (data.replyTo) {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.replyTo)) {
      errors.push('replyTo must be a valid email address');
    }
  }

  if (!data.subject || typeof data.subject !== 'string' || data.subject.trim().length === 0) {
    errors.push('subject is required and must be a non-empty string');
  }
  
  // Length validations
  if (data.senderEmail && data.senderEmail.length > 100) {
    errors.push('senderEmail must be 100 characters or less');
  }
  
  if (data.destination && data.destination.length > 100) {
    errors.push('destination must be 100 characters or less');
  }

  if (data.replyTo && data.replyTo.length > 100) {
    errors.push('replyTo must be 100 characters or less');
  }

  if (data.subject && data.subject.length > 200) {
    errors.push('subject must be 200 characters or less');
  }
  
  
  if (!data.text || typeof data.text !== 'string' || data.text.trim().length === 0) {
    errors.push('text is required and must be a non-empty string');
  }

  if (data.text && data.text.length > 5000) {
    errors.push('text must be 5000 characters or less');
  }
  
  if (!data.html || typeof data.html !== 'string' || data.html.trim().length === 0) {
    errors.push('html is required and must be a non-empty string');
  }

  if (data.html && data.html.length > 5000) {
    errors.push('html must be 5000 characters or less');
  }
  
  return errors;
};

// Health check endpoint
app.post('/health', authenticateApiKey, async (req, res) => {
    app.locals.transporter.verify((error, success) => {
        if (error) { 
            console.error('SMTP connection failed:', error);
            return res.status(500).json({ 
            error: 'Email service configuration error' 
            });
        }
        else {
          console.log('SMTP connection verified successfully');
          return res.status(200).json({ 
              status: 'healthy',
              timestamp: new Date().toISOString(),
              version: '1.0.0'
          });
        }
    });
});

// Send email endpoint
app.post('/send', authenticateApiKey, async (req, res) => {
  try {
    // Validate input
    const validationErrors = validateEmailInput(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: validationErrors
      });
    }
    
    const { destination, senderEmail, replyTo, subject, text, html } = req.body;
    
    // Email options
    const mailOptions = {
      from: senderEmail, // Use authenticated email as sender
      replyTo: replyTo || senderEmail, // Set reply-to as the original sender or a specified address
      to: destination,
      subject: subject,
      text: text,
      html: html,
    };
    
    // Send email
    const info = await app.locals.transporter.sendMail(mailOptions);
    
    console.log('Email sent successfully:', info.messageId);
    
    return res.status(200).json({ 
      success: true,
      message: 'Email sent successfully',
      messageId: info.messageId
    });
    
  } catch (error) {
    console.error('Error sending email:', error);
    
    // Handle specific nodemailer errors
    if (error.code === 'EAUTH') {
      return res.status(500).json({ 
        error: 'Email authentication failed' 
      });
    } else if (error.code === 'ECONNECTION') {
      return res.status(500).json({ 
        error: 'Failed to connect to email server' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to send email',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Handle 404s
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found' 
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ 
      error: 'Invalid JSON payload' 
    });
  }
  
  res.status(500).json({ 
    error: 'Internal server error' 
  });
});

// Start server
app.listen(3000, '0.0.0.0', () => {
  console.log(`Email server running on port 3000`);
  console.log(`Health check available at: http://localhost:3000/health`);
});
