require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const helmet = require('helmet');
const cors = require('cors');

// Environment variables validation
const requiredEnvVars = [
  'CLIENT_KEY', 
  'HOST_DOMAIN',
  'HOST_PORT',
  'RECIPIENT_ADDRESS',
  'SMTP_USER',
  'SMTP_PASSWORD'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
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
    disableUrlAccess: true // Disable URL access for security
});


// API key authentication middleware
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.get('X-API-Key');
  
  if (!apiKey) {
    return res.status(401).json({ 
      error: 'Missing X-API-Key header' 
    });
  }
  
  if (apiKey !== process.env.CLIENT_KEY) {
    return res.status(403).json({ 
      error: 'Invalid API key' 
    });
  }
  
  next();
};
// Input validation function
const validateEmailInput = (data) => {
  const errors = [];
  
  if (!data.senderName || typeof data.senderName !== 'string' || data.senderName.trim().length === 0) {
    errors.push('senderName is required and must be a non-empty string');
  }
  
  if (!data.senderEmail || typeof data.senderEmail !== 'string') {
    errors.push('senderEmail is required and must be a string');
  } else {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.senderEmail)) {
      errors.push('senderEmail must be a valid email address');
    }
  }
  
  if (!data.subject || typeof data.subject !== 'string' || data.subject.trim().length === 0) {
    errors.push('subject is required and must be a non-empty string');
  }
  
  if (!data.message || typeof data.message !== 'string' || data.message.trim().length === 0) {
    errors.push('message is required and must be a non-empty string');
  }
  
  // Length validations
  if (data.senderName && data.senderName.length > 100) {
    errors.push('senderName must be 100 characters or less');
  }
  
  if (data.subject && data.subject.length > 200) {
    errors.push('subject must be 200 characters or less');
  }
  
  if (data.message && data.message.length > 5000) {
    errors.push('message must be 5000 characters or less');
  }
  
  return errors;
};

// Health check endpoint
app.get('/health', authenticateApiKey, async (req, res) => {
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
    
    const { senderName, senderEmail, subject, message } = req.body;
    
    // Email options
    const mailOptions = {
      from: senderEmail, // Use authenticated email as sender
      replyTo: senderEmail, // Set reply-to as the original sender
      to: process.env.RECIPIENT_ADDRESS,
      subject: `Contact Form: ${subject}`,
      text: `From: ${senderName} (${senderEmail})\n\nMessage:\n${message}`,
      html: `
        <h3>Contact Form Submission</h3>
        <p><strong>From:</strong> ${senderName} (${senderEmail})</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `
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
