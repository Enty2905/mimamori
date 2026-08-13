# Mimamori AI (見守りAI)

Base monorepo cho nền tảng chăm sóc người cao tuổi tại Nhật Bản, gồm mobile,
backend, dịch vụ RAG nội bộ và hạ tầng phát triển local.

## Cấu trúc

- `backend/`: Java 21, Spring Boot 4.1, Maven.
- `app/`: React Native 0.86, TypeScript, Expo SDK 57.
- `ai/`: Python 3.13, FastAPI, RAG, Qdrant, uv.
- `docker/`: môi trường local cho MySQL, Redis, Qdrant và các service.
- `docs/`: kiến trúc, API contract, ADR, UX và đánh giá AI.

Repository hiện chỉ chứa bootstrap/configuration và skeleton thư mục; chưa có
business logic hay tính năng sản phẩm.

## Chuẩn bị môi trường

Sao chép `.env.example` thành `.env` và điền các giá trị local cần thiết. Không
commit `.env` hoặc thông tin bí mật.

## Lệnh khởi tạo

```text
cd backend && ./mvnw test
cd app && npm install && npm run typecheck
cd ai && uv sync && uv run pytest
docker compose -f docker/docker-compose.yml up -d
```
