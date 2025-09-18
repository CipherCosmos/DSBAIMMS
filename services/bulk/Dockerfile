FROM python:3.11-slim

WORKDIR /app

COPY services/bulk/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/bulk .
COPY shared ./shared

EXPOSE 8016

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8016"]