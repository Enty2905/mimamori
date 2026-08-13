# Local infrastructure

Copy the repository `.env.example` to `.env`, set local passwords, then run:

```text
docker compose -f docker/docker-compose.yml up -d
```

The base stack contains MySQL 8, Redis, Qdrant, the Spring Boot backend and the
internal Python AI service.
