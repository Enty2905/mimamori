# Cải thiện local Mimamori — 16/11/2026

Thực hiện trên branch `codex/improve-original-local`, từ giao diện gốc của
`7e73fb7`. Tái sử dụng có chọn lọc các module backend/RAG đã sửa trước đó,
kiểm tra lại rồi nối với màn hình gốc. Không áp dụng toàn bộ stash hoặc thay
giao diện bằng bộ màn hình remediation cũ. **Chưa commit hoặc push GitHub.**

## Thay đổi theo thứ tự ưu tiên

1. **Bảo mật:** tắt reset mật khẩu không xác minh; bỏ secret/default khỏi source;
   JWT bắt buộc cấu hình riêng; refresh token hash/rotate/revoke; chặn tài khoản
   không liên kết đọc/sửa cảnh báo. Liên kết gia đình mới cần elderly đồng ý,
   quyền xem hội thoại mặc định tắt. Profile chỉ nhận các trường có thể sửa,
   validate độ dài/ngôn ngữ/timezone và không cho đổi role từ body.
2. **SOS/check-in:** API SOS authenticated và idempotent; UI chỉ thông báo server
   ghi nhận, không giả người thân đã nhận; lỗi có thử lại với cùng request ID.
   Check-in gửi mã ổn định độc lập ngôn ngữ, backend tương thích nhãn ja/vi cũ;
   rule nguy cơ chạy khi không có LLM. Bỏ tên người nhận SOS mẫu và các bảo đảm
   an toàn/sức khỏe không có bằng chứng.
3. **Thuốc:** Quartz JDBC/Flyway V1–V8; occurrence ID, UTC/timezone/DST, sinh cữ
   lặp và reconciliation; xác nhận explicit/idempotent; FCM/outbox retry hữu hạn.
   Mobile có SQLite cache/confirmation queue theo owner, chống gửi trùng,
   hiển thị chờ đồng bộ/xung đột, xác minh quyền khi mở dose deep link. Dashboard
   và form thuốc dùng cùng người thân đang chọn. Thêm/sửa dùng form có validation;
   ngừng lịch ở khu quản lý riêng, có xác nhận, không nằm cạnh xác nhận liều.
4. **UI gốc:** giữ logo lá, ảnh tưới cây, màu kem/sage, thẻ wellness/menu/timeline.
   Đưa cữ tiếp theo trước menu; định dạng giờ đúng; bỏ số đo viết sẵn và 100%
   khi chưa có dữ liệu. Loading/error/retry/empty/stale/pending rõ hơn. Chữ và
   vùng chạm lớn hơn, tăng tương phản; dark/high contrast thực và có lưu. Giữ
   welcome gốc, đưa CTA lên trước ba thẻ giá trị. Sửa hàng caregiver/family bị
   chật, nhãn tab Nhật dài và label cỡ chữ.
5. **Chất lượng:** API tập trung, TanStack Query quản lý server state,
   Zustand giữ identity/settings; routes mỏng, SecureStore giữ token. Forms dùng
   React Hook Form + Zod; sửa cảnh báo React Compiler bằng `useWatch`.
   Ja/vi cho nội dung gốc và trạng thái mới; TTS đọc phản hồi thật, không tạo
   lời đáp giả khi request lỗi. Chat SSE có cancel/retry. Có RAG ingestion,
   retrieval/evaluation có traceability, nguồn được duyệt, model revision cố định,
   bounded context và fallback; chưa cần training. CI không bỏ qua AI lint,
   lockfile hoặc mobile thiếu test; thêm credential scan.
6. **SDK:** giữ Expo 58/RN 0.88.1, đồng bộ các bản vá Expo theo CLI chính thức,
   cập nhật config plugin bằng app config. Không sửa tay project native sinh ra.

## Kiểm tra đã chạy local

| Kiểm tra | Kết quả | Giới hạn |
|---|---|---|
| Backend Java 21/Maven | **30 test đạt**, không skip | Có MySQL/Testcontainers, auth/linkage, migrations, Quartz rows/reconciliation, confirmation, outbox và SSE |
| API thật với DB riêng | **20/20 đạt** | Dữ liệu tổng hợp; kiểm tra lại reset, quyền cảnh báo, consent, caregiver target, cữ lặp, retry xác nhận, SOS và refresh |
| Mobile | **43 test đạt** | 15 suites; API/session/SSE/queue/native guards và UI SOS, lỗi thuốc, login, ngôn ngữ/settings |
| Typecheck/lint | **Đạt** | Không thay thế nghiệm thu native |
| Expo Doctor | **20/20 đạt** | `expo install --check` cũng báo đồng bộ |
| Python/RAG | **60 đạt, 1 skip** | 58 test thường + 2 model test opt-in; model pin thật + Qdrant local. Một symlink test skip trên Windows |
| Ruff/uv lock | **Đạt** | Có deprecation warning từ dependency test; không bỏ qua lint lỗi |
| Dependency audit | **0 critical, 0 high**, còn 29 moderate + 1 low | Gồm dependency phát triển; không force downgrade SDK để xóa advisory |
| Credential scan | **Đạt trên source hiện tại** | Không xóa Git history hoặc thu hồi khóa ở provider |
| Android/iOS Hermes | **Export được bundle** | Không phải APK/IPA hoặc kiểm thử native integration |
| Visual | 20 ảnh, 0 page error, 0 overflow trong các mẫu; review độc lập | RNWeb source thật với API/native mock, rộng 360/390/768/1024, chữ 1.0/1.3, ja/vi, light/dark; sửa lỗi rồi chụp lại |
| Xiaomi/Expo Go | **Bản mới mở được**, có ảnh native welcome | Đã sửa crash do import native notifications ở Expo Go; chưa coi push/mic/background đạt |

Log local nằm trong `.git/codex-checks/2026-11-16/`, gồm
`backend-improvements-final.log`, `improvements-api-results.json`,
`mobile-final-verified.log`, `doctor-improvements-final.log`,
`ai-improvements.log`, `ai-model-improvements.log`, `npm-audit-final.json` và
`improvements-ui-review.md`. Đây là kết quả local, chưa phải kết quả CI GitHub.
Ảnh QA ở `.superdesign/improvements-20261116/captures/`.
Ảnh welcome native cuối ở `.git/codex-checks/2026-11-16/native-updated-final.png`;
không suy rộng thành đã thao tác hết các màn native. Kết quả tóm tắt máy đọc
ở `.git/codex-checks/2026-11-16/improvements-result.json`.

## Runtime và cách tiếp tục

- Backend loopback `127.0.0.1:18080`, database thử riêng
  `mimamori_improve_20261116`. Không migrate hoặc xóa database gốc/SCMS.
- Metro/Expo Go dùng `exp://127.0.0.1:8083`, USB reverse `8083` và `18080`.
  `app/.env.local` đặt API loopback; demo chỉ bật ở preview local.
- Metro phiên này tắt watch để tránh lỗi FallbackWatcher gây CPU cao trên
  Windows; sau sửa source cần khởi động lại Metro/reload để nhận bản mới.
- Preview dùng provider Groq tắt và Firebase chưa bật; chat dùng server fallback.
  Khi cấu hình provider thật, dùng khóa mới ngoài source và model qua config.

```powershell
cd C:\1_develop\mimamori\app
adb reverse tcp:18080 tcp:18080
adb reverse tcp:8083 tcp:8083
npm run start:go -- --localhost --port 8083 --clear
```

## Điều kiện còn cần trước khi phát hành

- **Expo Go là preview.** Native notifications/Firebase được nạp có điều kiện;
  trong Expo Go không giả thông báo đã được bật. Offline confirmation vẫn có
  thể đồng bộ; lịch local/push cần development build và nghiệm thu thiết bị.
- Cần Android development build, iOS/macOS, permission/exact alarm, background,
  restart/offline đa thiết bị, TalkBack/VoiceOver, bàn phím và cỡ chữ hệ thống.
  Ảnh web và bundle không xác nhận các phần này.
- FCM/APNs/Groq thật chưa kiểm thử giao nhận/generation; SOS receipt không
  chứng minh người thân đã nhận hoặc đọc. STT và LINE chưa được triển khai;
  nút giọng nói hiện dùng TTS đọc lời đáp, không giả thu âm.
- Recovery vẫn tắt cho tới khi có kênh xác minh quyền sở hữu. Nếu khóa provider
  trong lịch sử Git từng là khóa thật, cần thu hồi/thay khóa ở provider.
- Corpus mẫu chỉ là hướng dẫn vận hành sản phẩm, chưa phải tri thức y khoa
  đã được thẩm định. Không coi điểm retrieval nhỏ là độ chính xác y khoa.
- Theo dõi 30 advisory còn lại và cập nhật có mục tiêu; không chạy
  `npm audit fix --force` hoặc hạ baseline.

Không đưa báo cáo local này thành cam kết sẵn sàng sử dụng lâm sàng hoặc
phát hành. Toàn bộ thay đổi vẫn đang local để người dùng xem trước.
