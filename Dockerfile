FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy package files and install Node.js dependencies for frontend
COPY package*.json ./
RUN apt-get update && apt-get install -y nodejs npm && npm install

# Copy all application code
COPY . .

# Set Python path
ENV PYTHONPATH=/app

# Expose ports (this is just for documentation, actual ports are handled by docker-compose)
EXPOSE 3000 8000-8026

# Default command (this would need to be overridden in docker-compose)
CMD ["echo", "Use docker-compose to run individual services"]