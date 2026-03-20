FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /build

COPY apps/map-ai/agent/README.md ./README.md
COPY apps/map-ai/agent/pyproject.toml ./pyproject.toml
COPY apps/map-ai/agent/map_ai_agent ./map_ai_agent

RUN pip install --no-cache-dir .

WORKDIR /app

EXPOSE 8001

CMD ["uvicorn", "map_ai_agent.hello:app", "--host", "0.0.0.0", "--port", "8001"]
