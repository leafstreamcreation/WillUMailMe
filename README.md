# WillUMailMe

A Dockerized Express.js email server that provides a secure API endpoint for sending emails via SMTP. Perfect for contact forms, notifications, and other email automation needs.

## Features

- 🔐 **API Key Authentication** - Secure access using X-API-Key header
- 📧 **SMTP Email Sending** - Uses Nodemailer with configurable SMTP settings
- 🛡️ **Security First** - Helmet.js, input validation, and content-type checking
- 🐳 **Docker Ready** - Fully containerized with health checks
- ⚡ **Express.js** - Fast and lightweight HTTP server
- 🔍 **Input Validation** - Comprehensive validation for all email fields
- 📊 **Health Monitoring** - Built-in health check endpoint

## Quick Start

### Using Docker Compose (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd WillUMailMe
```

2. Create your environment file:
```bash
cp .env.example .env
```

3. Edit `.env` with your SMTP credentials

4. Start the service:
```bash
docker-compose up -d
```

### Using Docker Build

1. Build the image:
```bash
docker build -t willuemailme .
```

2. Run the container:
```bash
docker run -d \
  -p 80:80 \
  -e HOST_DOMAIN=smtp.gmail.com \
  -e CLIENT_KEY=your-api-key \
  -e RECIPIENT_ADDRESS=your-email@gmail.com \
  -e RECIPIENT_PASSWORD=your-password \
  -e PORT=80 \
  --name willuemailme \
  willuemailme
```

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file with your configuration

3. Start the server:
```bash
npm start
```

## API Usage

### Send Email

**Endpoint:** `POST /send`

**Headers:**
```
Content-Type: application/json
X-API-Key: your-api-key-here
```

**Request Body:**
```json
{
  "senderName": "John Doe",
  "senderEmail": "john@example.com", 
  "subject": "Contact Form Submission",
  "message": "Hello, this is a test message from the contact form."
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Email sent successfully",
  "messageId": "<unique-message-id>"
}
```

**Error Response (400/401/403/500):**
```json
{
  "error": "Error description",
  "details": ["Validation error details"]
}
```

### Health Check

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-20T10:30:00.000Z",
  "version": "1.0.0"
}
```

**Note:** For Gmail, you need to:
1. Enable 2-factor authentication
2. Generate an App Password (not your regular password)
3. Use the 16-character app password


## Security Features

- **API Key Authentication**: All requests require valid X-API-Key header
- **Input Validation**: Comprehensive validation of all input fields
- **Content-Type Checking**: Only accepts application/json
- **Helmet.js**: Security headers and protection middleware
- **Rate Limiting**: Built-in Express.js protections
- **Error Handling**: Secure error responses without sensitive data leak

## Validation Rules

- **senderName**: Required, non-empty string, max 100 characters
- **senderEmail**: Required, valid email format
- **subject**: Required, non-empty string, max 200 characters  
- **message**: Required, non-empty string, max 5000 characters

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Email sent successfully |
| 400 | Bad request (validation failed, invalid JSON, wrong content-type) |
| 401 | Missing API key |
| 403 | Invalid API key |
| 404 | Endpoint not found |
| 500 | Server error (SMTP issues, configuration problems) |

## Development

### Project Structure
```
├── server.js              # Main Express.js server
├── package.json            # Node.js dependencies
├── Dockerfile             # Docker container configuration
├── .dockerignore          # Docker ignore rules
├── docker-compose.yml     # Docker Compose configuration
├── .env.example           # Environment variables template
└── README.md              # This file
```

### Testing the API

Using curl:
```bash
curl -X POST http://localhost:80/send-email \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "senderName": "Test User",
    "senderEmail": "test@example.com",
    "subject": "Test Email",
    "message": "This is a test message."
  }'
```

Using JavaScript fetch:
```javascript
fetch('http://localhost:80/send-email', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'
  },
  body: JSON.stringify({
    senderName: 'Test User',
    senderEmail: 'test@example.com', 
    subject: 'Test Email',
    message: 'This is a test message.'
  })
})
.then(response => response.json())
.then(data => console.log(data));
```

## Production Deployment

### Docker Compose (Recommended)

1. Set up your production `.env` file
2. Deploy using docker-compose:
```bash
docker-compose up -d
```

### Manual Docker Deployment

1. Build production image:
```bash
docker build -t willuemailme:latest .
```

2. Run with production settings:
```bash
docker run -d \
  --name willuemailme-prod \
  --restart unless-stopped \
  -p 80:80 \
  --env-file .env \
  willuemailme:latest
```

## Monitoring

The service includes a health check endpoint at `/health` that can be used for:
- Docker health checks (configured automatically)
- Load balancer health monitoring  
- Service monitoring tools
- Kubernetes liveness/readiness probes

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:
1. Check the logs: `docker logs willuemailme`
2. Verify your SMTP configuration
3. Test the health endpoint: `curl http://localhost:80/health`
4. Open an issue on GitHub