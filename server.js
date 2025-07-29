require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const helmet = require('helmet');

const app = express();

// Security middleware
app.use(helmet());

// Middleware to parse JSON and validate content-type
app.use('/send-email', (req, res, next) => {
  if (req.get('Content-Type') !== 'application/json') {
    return res.status(400).json({ 
      error: 'Content-Type must be application/json' 
    });
  }
  next();
});

app.use(express.json({ limit: '1mb' }));

// Environment variables validation
const requiredEnvVars = [
  'HOST_DOMAIN',
  'CLIENT_KEY', 
  'RECIPIENT_ADDRESS',
  'RECIPIENT_PASSWORD',
  'PORT'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

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

// Create nodemailer transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.HOST_DOMAIN,
    port: 587, // Standard SMTP port for TLS
    secure: false, // Use TLS
    auth: {
      user: process.env.RECIPIENT_ADDRESS,
      pass: process.env.RECIPIENT_PASSWORD
    },
    tls: {
      rejectUnauthorized: false // For development/testing
    }
  });
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
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Send email endpoint
app.post('/send-email', authenticateApiKey, async (req, res) => {
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
    
    // Create transporter
    const transporter = createTransporter();
    
    // Verify SMTP connection
    try {
      await transporter.verify();
    } catch (verifyError) {
      console.error('SMTP connection failed:', verifyError);
      return res.status(500).json({ 
        error: 'Email service configuration error' 
      });
    }
    
    // Email options
    const mailOptions = {
      from: `"${senderName}" <${process.env.RECIPIENT_ADDRESS}>`, // Use authenticated email as sender
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
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Email sent successfully:', info.messageId);
    
    res.json({ 
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
const PORT = process.env.PORT || 80;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Email server running on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
});
