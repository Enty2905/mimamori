# Vận hành retrieval và hợp đồng RAG

Python cung cấp retrieval nội bộ, Spring Boot áp dụng guardrails rồi gọi Groq qua
Spring AI ChatClient. Mobile chỉ gọi API Spring, gồm SSE cho câu trả lời. Lịch
thuốc không phụ thuộc dịch vụ AI. Chuẩn bị nguồn theo [ingestion](run-ingestion.md).

## API nội bộ

POST `/internal/v1/retrievals`, header `X-Internal-Token` lấy từ secret runtime.
Ví dụ request không chứa dữ liệu người dùng thật:

```json
{
  "query": "Thông báo xuất hiện có nghĩa là đã uống thuốc chưa?",
  "language": "vi",
  "top_k": 3,
  "max_context_tokens": 384
}
```

Contract: [OpenAPI](api/internal-rag-openapi.json),
[context example](api/rag-context-example.json),
[no-context example](api/rag-no-context-example.json).

Giới hạn: query 2.000 ký tự/256 token, request 16KiB, top_k 1–10,
max_context_tokens 64–1.024, tối đa 20 source/document IDs mỗi loại. Mỗi đoạn phải
vừa bounded context budget và giữ nguồn, section, revision, timestamp, hash,
embedding pipeline và score. Score cosine không phải xác suất đúng về y khoa.

Các filter bắt buộc: public, nguồn hiện approved, đúng version/checksum/language/
pipeline. Query không được ghi vào shared Qdrant, corpus hoặc log. Các trạng thái
no_context gồm NO_MATCH, LOW_CONFIDENCE, QUERY_TOO_LONG, BUDGET_EXHAUSTED, BUSY,
INVALID_INDEX, UNAVAILABLE; Spring trả safe fallback khi retrieval không sẵn sàng.
Auth/validation/size lỗi có status HTTP riêng theo contract. Retrieved text là dữ
liệu tham khảo, không có quyền ghi đè system safety instructions.

## Cấu hình Spring

Đặt `RAG_ENABLED=true`, `AI_SERVICE_URL` và `RAG_INTERNAL_TOKEN` giống dịch vụ
Python. Khi chạy host theo Compose mặc định, URL là `http://127.0.0.1:18000`;
backend trong Compose dùng `http://ai:8000`. LLM mặc định tắt; để bật, đặt
`SPRING_AI_MODEL_CHAT=openai`, `GROQ_API_KEY`, `GROQ_MODEL` ở server. Không đặt
provider key trong EXPO_PUBLIC_* hoặc client.

Public contract ở [public-openapi.json](api/public-openapi.json). Companion SSE
phát delta/done/error; request UUID chống tạo lặp khi retry, partial failure không
được lưu thành câu trả lời hoàn chỉnh. Caregiver cần liên kết accepted và quyền
xem hội thoại rõ ràng; mặc định quyền này tắt.

## Đánh giá

```powershell
# Trong ai/, Qdrant test URL phải trỏ tới server thực.
$env:RAG_TEST_QDRANT_URL = 'http://127.0.0.1:16333'
$env:RAG_RUN_MODEL_TESTS = '1'
uv run python -m pytest
uv run python -m src.evaluation.retrieval --output ../docs/evaluation/retrieval-baseline.json
```

Evaluator dùng collection riêng rồi dọn; bộ câu hỏi cố định tại
`ai/src/evaluation/questions-v1.json`. Hit@k đo câu có ít nhất một section đúng;
recall@k đo tỷ lệ relevant sections; no-context accuracy đo câu ngoài phạm vi.
Đây là bộ mẫu kỹ thuật nhỏ ja/vi, không phải nghiệm thu lâm sàng. Kết quả và giới
hạn hiện tại ở [báo cáo remediation](remediation-2026-11-08.md).
