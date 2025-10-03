# Use the official Node.js Alpine image
FROM node:lts-slim

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY ./server.js .
COPY ./healthcheck.js .

# Create a non-root user to run the application
RUN addgroup --gid 1001 --system nodejs && \
    adduser --system nodeuser -u 1001

# Change ownership of the app directory to the nodejs user
RUN chown -R nodeuser:nodejs /app
USER nodeuser

# Expose the port the app runs on
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node ./healthcheck.js || exit 1
# Start the application
CMD ["npm", "start"]
