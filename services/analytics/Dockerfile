FROM python:3.11-slim

WORKDIR /app

COPY services/analytics/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/analytics .
COPY shared ./shared

EXPOSE 8015

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8015"]