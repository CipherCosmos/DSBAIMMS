FROM python:3.11-slim

WORKDIR /app

COPY services/users/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/users .
COPY shared ./shared

EXPOSE 8011

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8011"]