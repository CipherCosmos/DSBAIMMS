FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
COPY services/files/requirements.txt ./services/files/

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir -r services/files/requirements.txt

# Copy shared modules
COPY shared/ ./shared/

# Copy service code
COPY services/files/ ./services/files/

# Set Python path
ENV PYTHONPATH=/app

# Create uploads directory
RUN mkdir -p /app/uploads

# Expose port
EXPOSE 8019

# Run the service
CMD ["python", "services/files/main.py"]
