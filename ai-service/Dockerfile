FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY ai-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --default-timeout=300 --retries=10 -r requirements.txt
COPY ai-service/app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
