# Vận hành ingestion RAG

Dịch vụ nội bộ dùng Python 3.13/uv, sentence-transformers và Qdrant. Mobile chỉ
truy cập Spring Boot. Corpus hiện gồm tài liệu vận hành sản phẩm ja/vi tổng hợp;
không xem đây là nguồn y khoa đã được thẩm định.

## Khởi động và lập chỉ mục

Điền `.env` tại root theo README (mật khẩu MySQL, JWT và RAG_INTERNAL_TOKEN riêng).
Token nội bộ phải có ít nhất 32 byte. Không đưa token vào URL hoặc log.

```sh
docker compose --env-file .env -f docker/docker-compose.yml up -d --build
docker compose --env-file .env -f docker/docker-compose.yml exec -T ai python -m src.ingestion.cli list
docker compose --env-file .env -f docker/docker-compose.yml exec -T ai python -m src.ingestion.cli ingest reminders-ja reminders-vi
```

Lần đầu tải mô hình public, khóa theo revision trong `ai/src/common/settings.py`.
Model/state trong container hiện không có volume riêng: khi recreate container,
cần ingest lại; Qdrant vẫn có volume lưu vectors. Với vận hành lâu dài, cấp volume
và quyền ghi tương ứng cho `/app/models` và `/app/artifacts`. Không mở nhiều writer
với state/lock khác nhau trên cùng collection.

Chạy trên host (PowerShell, trong `ai/`):

```powershell
uv sync --locked
$env:RAG_QDRANT_URL = 'http://127.0.0.1:16333'
uv run python -m src.ingestion.cli list
uv run python -m src.ingestion.cli ingest reminders-ja reminders-vi
uv run python -m uvicorn src.api.main:app --host 127.0.0.1 --port 18000
```

Thiết lập RAG_INTERNAL_TOKEN trong môi trường tiến trình trước khi gọi internal
API. `/health/live` chỉ chứng minh process sống; `/health/ready` cần header
`X-Internal-Token`, kiểm tra Qdrant, không đảm bảo model đã tải.

## Nguồn và thu hồi

Manifest tại `ai/datasets/approved/manifest.json` kiểm soát source ID, đường dẫn,
checksum, version, language và sensitivity. Nguồn phải được duyệt, public và không
chứa dữ liệu sức khỏe/hội thoại riêng tư hoặc credential. Không sửa checksum chỉ
để bỏ qua review nguồn. Parser kiểm tra kích thước, đường dẫn, symlink và dữ liệu
nhạy cảm; không xem kiểm tra tự động là thay thế cho duyệt nội dung.

Ingestion tạo deterministic document/chunk IDs, giữ metadata truy vết và pipeline
hash; ingest lại cùng nguồn không tạo bản trùng. Cập nhật có chủ ý bằng manifest
mới, chạy lại ingest. Khi đổi model/chunking, tạo collection theo pipeline mới và
re-index toàn bộ nguồn đã duyệt trước khi chuyển consumer.

Để thu hồi, đặt approved=false rồi purge key qua CLI:

```sh
python -m src.ingestion.cli purge reminders-vi
```

Purge chỉ tác động collection hiện tại; operator phải quản lý cả index lịch sử.
Retrieval còn lọc nguồn/phiên bản/checksum hiện đang approved để tránh dùng đoạn
đã bị thu hồi nhưng chưa purge. File lock dùng chung cho ingestion/retrieval;
không có transaction phân tán cho nhiều writer.

## Kiểm thử

```powershell
uv run ruff check src tests
uv run python -m pytest -m 'not model'
$env:RAG_TEST_QDRANT_URL = 'http://127.0.0.1:16333'
$env:RAG_RUN_MODEL_TESTS = '1'
uv run python -m pytest
```

Integration tạo collection ngẫu nhiên và tự dọn. Model smoke có thể tải public
model. Windows không có quyền symlink có thể skip một test; báo riêng khỏi pass.
Kết quả lượt sửa hiện tại: [báo cáo remediation](remediation-2026-11-08.md).
