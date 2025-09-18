FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
COPY services/notifications/requirements.txt ./services/notifications/

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir -r services/notifications/requirements.txt

# Copy shared modules
COPY shared/ ./shared/

# Copy service code
COPY services/notifications/ ./services/notifications/

# Set Python path
ENV PYTHONPATH=/app

# Expose port
EXPOSE 8018

# Run the service
CMD ["python", "services/notifications/main.py"]
