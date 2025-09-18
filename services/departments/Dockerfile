FROM python:3.11-slim

WORKDIR /app

COPY services/departments/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/departments .
COPY shared ./shared

EXPOSE 8012

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8012"]