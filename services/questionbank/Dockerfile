FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
COPY services/questionbank/requirements.txt ./services/questionbank/

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir -r services/questionbank/requirements.txt

# Copy shared modules
COPY shared/ ./shared/

# Copy service code
COPY services/questionbank/ ./services/questionbank/

# Set Python path
ENV PYTHONPATH=/app

# Expose port
EXPOSE 8020

# Run the service
CMD ["python", "services/questionbank/main.py"]
