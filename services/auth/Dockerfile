FROM python:3.11-slim

WORKDIR /app

# Install build dependencies for bcrypt
RUN apt-get update && apt-get install -y \
    build-essential \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

COPY services/auth/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Remove build dependencies to keep image size small
RUN apt-get purge -y build-essential libffi-dev && apt-get autoremove -y

COPY services/auth .
COPY shared ./shared

EXPOSE 8010

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8010"]