FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared modules
COPY shared/ ./shared/

# Copy service code
COPY services/semesters/ ./services/semesters/

# Set Python path
ENV PYTHONPATH=/app

# Expose port
EXPOSE 8006

# Run the service
CMD ["python", "-m", "uvicorn", "services.semesters.main:app", "--host", "0.0.0.0", "--port", "8006", "--reload"]