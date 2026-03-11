FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Expose the port from .env or default to 8000
EXPOSE 8000

# Start the Node.js process using server.js
CMD ["npm", "start"]
