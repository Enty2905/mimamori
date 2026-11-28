# Mimamori — bảo toàn giao diện gốc, 16/11/2026

Mục tiêu: giúp người cao tuổi đọc được cữ tiếp theo, xác nhận thuốc và nhờ hỗ
trợ; caregiver xem đúng người thân đã đồng ý liên kết. Giữ hướng hình ảnh của
7e73fb7, không thay bằng bộ màn hình remediation trước đó.

- Cảm giác: bình tĩnh, ấm, gần gũi; nhịp của một ngày chăm sóc trong gia đình.
- Từ vựng: lá, vườn, ngôi nhà, cữ thuốc, thăm hỏi, gia đình, nhật ký.
- Màu: kem #F8F5EF, sage #456B58, xanh rừng #2F4B3C, cát #F0ECE1,
  hổ phách #E6C994. Chữ phụ được tăng tương phản; trạng thái có chữ và icon.
- Giữ logo lá, ảnh cụ bà tưới cây, greeting/avatar, thẻ wellness, menu và timeline
  thuốc gốc. Welcome đưa hành động vào trước ba thẻ giá trị để dễ bắt đầu.
- Đặc trưng: chiếc lá và nhịp kiểm tra hằng ngày, cữ tiếp theo trước menu.
- Typography: font native, nội dung chính 20sp+, hỗ trợ phóng chữ, chữ phụ có
  ngưỡng dễ đọc. Controls tối thiểu 56dp, không dùng chiều cao cố định cho chữ.
- Dark/high contrast dùng token thực và được lưu; không chỉ đổi switch.
- UI không hiển thị số đo giả, 100% khi không có dữ liệu hoặc hứa đã giao SOS.
- Logic mới dùng API tập trung, TanStack Query, SecureStore và SQLite; utility
  components phục vụ cùng nhận diện, không thay toàn bộ bố cục màn hình.

CKW entry/thinking/system/spatial được đọc từ bản skill đã lưu trong stash cũ,
không áp dụng toàn bộ stash. SuperDesign không tạo canvas mới vì đã có hướng
và component gốc phù hợp. Review riêng qua ảnh, sửa và render lại. RNWeb dưới
`.superdesign/improvements-20261116` là artifact QA với dữ liệu/native mock,
không phải web MVP hoặc bằng chứng native. Reviewer kế thừa mô hình phiên;
công cụ không cung cấp chi phí/tên phiên bản riêng, không gọi dịch vụ thiết kế ngoài.
