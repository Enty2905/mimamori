# Mimamori AI (見守りAI)

Base monorepo cho nền tảng chăm sóc người cao tuổi tại Nhật Bản, gồm mobile,
backend, dịch vụ RAG nội bộ và hạ tầng phát triển local.

## Cấu trúc

- `backend/`: Java 21, Spring Boot 4.1, Maven.
- `app/`: React Native 0.88, TypeScript, Expo SDK 58.
- `ai/`: Python 3.13, FastAPI, RAG, Qdrant, uv.
- `docker/`: môi trường local cho MySQL, Redis, Qdrant và các service.
- `docs/`: kiến trúc, API contract, ADR, UX và đánh giá AI.

Đã có đăng nhập/refresh phiên, liên kết gia đình cần đồng ý, check-in,
quản lý và xác nhận thuốc, lịch Quartz JDBC, cảnh báo và trò chuyện SSE.
Dịch vụ RAG xử lý nguồn được duyệt, truy xuất Qdrant và fallback có giới hạn.
Giao diện giữ nhận diện kem–xanh, hỗ trợ Việt/Nhật và cài đặt hiển thị.

Bản tích hợp bổ sung avatar, màu tối cho người chăm sóc, API sinh hoạt, hồ sơ
sức khỏe và API phiên âm từ GitHub. Luồng điều hướng và nhắc thuốc dùng cơ chế
đã kiểm thử trên máy. Giao diện nhắc sinh hoạt và nhập giọng nói của nhánh
GitHub chưa nối vào điều hướng này. Hỏi đáp qua ảnh thuốc và DeepSeek không
được bật trong bản tích hợp. Tài liệu tính năng của nhánh GitHub nằm trong
[tổng quan AI](docs/companion-ai-architecture.md) và
[báo cáo giao diện](docs/frontend-report.md).

## Chuẩn bị môi trường

Sao chép `.env.example` thành `.env` và điền các giá trị local cần thiết. Không
commit `.env` hoặc thông tin bí mật.

Flyway giữ V1–V5 của GitHub và chạy các migration từ bản local ở V6–V12.
Database từng chạy migration V2–V8 của bản local 16/11 có lịch sử khác. Dùng
schema mới khi thử bản tích hợp để giữ nguyên database cũ.

## Lệnh khởi tạo

```text
cd backend && ./mvnw test
cd app && npm ci && npm run typecheck && npm test -- --runInBand
cd ai && uv sync && uv run pytest
docker compose -f docker/docker-compose.yml up -d
```

## Chạy mobile

```text
cd app
npx expo run:android
npm start
```

Production/native integration dùng development build. `npm run start:go` dùng
để xem trước giao diện bằng Expo Go; không xác nhận được FCM, STT hoặc
Crashlytics. Nếu dùng điện thoại USB với backend loopback, cấu hình
`app/.env.local` và `adb reverse` cho đúng cổng backend/Metro.

Tài khoản demo chỉ hiện khi `EXPO_PUBLIC_DEMO_MODE=true`; dữ liệu demo phải nằm
trong database local riêng. Không bật cấu hình này cho bản phát hành.

Xem [kết quả cải thiện local 16/11/2026](docs/improvements-2026-11-16.md),
[API](docs/api/public-openapi.json) và [hướng chạy RAG](docs/run-retrieval.md).
