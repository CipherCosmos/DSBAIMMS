FROM python:3.11-slim

WORKDIR /app

COPY services/exams/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/exams .
COPY shared ./shared

EXPOSE 8013

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8013"]