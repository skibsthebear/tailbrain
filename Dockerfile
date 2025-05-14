FROM node:18-alpine

WORKDIR /app

# Copy package.json files first for better cache utilization
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm install
RUN npm install --prefix frontend
RUN npm install --prefix backend

# Copy the rest of the application
COPY . .

# Build the frontend
RUN npm run build

# Expose the backend port (using an uncommon port)
EXPOSE 7654

# Set environment variable for the backend port
ENV PORT=7654
ENV NODE_ENV=production

# Command to run the app in production mode
CMD ["npm", "start"] 