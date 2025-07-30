# Use the official Node.js Alpine image
FROM node:alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Create a non-root user to run the application
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# Change ownership of the app directory to the nodejs user
RUN chown -R nodeuser:nodejs /app
USER nodeuser

# Expose the port the app runs on
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
CMD ["npm", "start"]
