FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY services/exports/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/exports .
COPY shared ./shared

EXPOSE 8017

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8017"]