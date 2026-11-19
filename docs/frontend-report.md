# Báo Cáo Chi Tiết Thiết Kế & Bố Cục Frontend — Mimamori AI (`e:\mimamori\app`)

> Tài liệu mô tả toàn diện kiến trúc giao diện, hệ thống thiết kế (**Design System**), thông số kích thước – màu sắc – tỷ lệ, sơ đồ bố cục chi tiết của từng màn hình và cơ chế đáp ứng (responsive) trên toàn bộ phần Frontend (`e:\mimamori\app`).

---

## 1. Hệ thống Thiết kế (Design System — Eldora Warm Minimalism)

Giao diện Mimamori AI được xây dựng theo ngôn ngữ **Warm Minimalism (Tối giản Ấm áp)** lấy cảm hứng từ chăm sóc người cao tuổi kiểu Nhật, ưu tiên độ tương phản dịu mắt, góc bo tròn thân thiện, vùng chạm tối thiểu `44–56px` và chữ lớn dễ đọc.

### 1.1. Bảng màu chuẩn ([colors.ts](file:///e:/mimamori/app/src/core/theme/colors.ts))

| Nhóm màu | Token | Mã HEX | Mục đích sử dụng trong bố cục |
| :--- | :--- | :--- | :--- |
| **Nền (Backgrounds)** | `background` | `#F8F5EF` | Nền kem ấm áp toàn ứng dụng, giảm chói mắt so với trắng tinh |
| | `surface` | `#FFFEFC` | Bề mặt card chính, modal sheet, thanh bottom navigation |
| | `surfaceWarm` | `#F0ECE1` | Nền ô nhập liệu (`TextInput`), chip, hộp tóm tắt phụ |
| | `surfaceMuted` | `#EAE5D9` | Đường ngăn cách nhẹ, trạng thái nền trung tính |
| **Thương hiệu (Brand)** | `primary` | `#456B58` | Xanh rêu sage chủ đạo (nút chính, tab active, viền chọn, icon) |
| | `primaryDark` | `#2F4B3C` | Trạng thái nhấn, chữ nhấn đậm trên nền xanh nhạt |
| | `primaryLight` | `#E6EEE7` | Nền badge, icon container, pill được chọn |
| | `secondaryLight` | `#EEF4EF` | Nền thẻ lời khuyên sức khỏe / thảo mộc dịu |
| **Điểm nhấn (Accent)** | `accent` / `accentDark` / `accentLight` | `#E6C994` / `#8F6624` / `#FDF7EB` | Màu hổ phách ấm (icon mặt trời, nhãn lời khuyên, điểm nhấn ấm) |
| **Văn bản (Typography)** | `textPrimary` | `#26332D` | Chữ tiêu đề, nội dung chính (than sẫm pha rêu, độ tương phản cao) |
| | `textSecondary` | `#727C75` | Phụ đề, nhãn mô tả, metadata |
| | `textMuted` | `#9BA39D` | Chữ gợi ý (`placeholder`), thời gian, nhãn mờ |
| **Đường viền (Borders)** | `border` / `borderLight` / `divider` | `#E3DDD2` / `#EFEBE2` / `#EBE6DC` | Viền mảnh `1px` tách biệt card trên nền kem |
| **Ngữ nghĩa (Semantic)** | `success` / `successText` / `successBorder` | `#EDF6F0` / `#326847` / `#C9E5D4` | Đã uống thuốc, hoàn thành, bình thường, an toàn |
| | `warning` / `warningText` / `warningBorder` | `#FEF6EC` / `#995C17` / `#F9DDBE` | Cần nhắc nhở, cảnh báo mức trung bình |
| | `danger` / `dangerText` / `dangerBorder` | `#FDF0F0` / `#B83232` / `#F6C8C8` | Nút SOS khẩn cấp, bỏ lỡ thuốc, đăng xuất, cảnh báo đỏ |

### 1.2. Hệ thống Đổ bóng & Hình khối (`shadows` & Border Radius)

| Loại hình khối | Thông số thiết kế chuẩn |
| :--- | :--- |
| **Đổ bóng (`shadows`)** | • `subtle`: `shadowColor: '#26332D'`, `offset(0, 2)`, `opacity: 0.05`, `radius: 8`, `elevation: 2`<br>• `card`: `offset(0, 4)`, `opacity: 0.06`, `radius: 12`, `elevation: 3`<br>• `elevated` (Modal): `offset(0, 6)`, `opacity: 0.1`, `radius: 16`, `elevation: 6` |
| **Quy chuẩn bo góc (`borderRadius`)** | • **Bottom Sheet Modal:** `borderTopLeftRadius / Right: 30–32px`<br>• **Hero Card / Wellness Card / Modal Center:** `22–24px`<br>• **Card tiêu chuẩn & Option Card:** `18–20px`<br>• **Nút bấm & Ô nhập liệu (`Input`):** `14–18px`<br>• **Chip, Pill, Badge nhỏ:** `8–14px` |

### 1.3. Thang đo Chữ động & Tiếp cận ([useAccessibilityStore.ts](file:///e:/mimamori/app/src/core/accessibility/useAccessibilityStore.ts))

Hệ thống hỗ trợ phóng to/thu nhỏ toàn bộ cỡ chữ qua hàm `fs(baseSize) = Math.round(baseSize * fontScale)`, lưu bền vững trong `SecureStore` / `localStorage`:

| Mức (`FontSizeLevel`) | Nhãn hiển thị | Tỷ lệ (`fontScale`) | Mục đích thiết kế |
| :--- | :--- | :--- | :--- |
| `small` | Nhỏ | `0.9` (90%) | Hiển thị gọn, nhiều nội dung trên màn hình nhỏ |
| `standard` | Tiêu chuẩn | `1.0` (100%) | Cỡ chữ mặc định cân đối |
| `large` | Lớn | `1.15` (115%) | Chữ to, dịu mắt cho người lớn tuổi |
| `xlarge` | Rất lớn | `1.3` (130%) | Tối ưu cho người cao tuổi thị lực kém |

---

## 2. Khung bố cục tổng thể (App Shell & Bottom Navigation)

Tất cả các màn hình đều nằm trong cấu trúc vỏ chung tại [\_layout.tsx](file:///e:/mimamori/app/src/app/_layout.tsx) và [index.tsx](file:///e:/mimamori/app/src/app/index.tsx):

```text
+--------------------------------------------------+
| SafeAreaView (edges: top, left, right, #F8F5EF)  |
|  +--------------------------------------------+  |
|  |                                            |  |
|  |   Vùng nội dung chính (flex: 1)            |  |
|  |   - ScrollView / FlatList                  |  |
|  |   - paddingBottom: 100..120 (chống che)    |  |
|  |                                            |  |
|  +--------------------------------------------+  |
|  | Bottom Navigation Bar (#FFFEFC, borderTop) |  |
|  |  [Icon]   [Icon]   [Icon]   [Icon]  [Icon] |  |
|  |   Nhãn     Nhãn     Nhãn     Nhãn    Nhãn  |  |
|  |    •  <-- Chấm tròn active (4x4, #456B58)  |  |
|  +--------------------------------------------+  |
|  (paddingBottom tự động: max(insets.bottom, 10)) |
+--------------------------------------------------+
```

* **Màn hình chờ (`isLoading`):** Căn giữa tuyệt đối, card trắng bo `24px`, `padding: 32`, logo lá `68x68`, `ActivityIndicator` xanh sage, tiêu đề `fs(22)`.
* **Thanh điều hướng đáy (`bottomNav`):** Nền `#FFFEFC`, `borderTopWidth: 1` (`#EFEBE2`), `paddingTop: 8`, `paddingHorizontal: 8`. Mỗi tab (`navItem`) có `flex: 1`, `minHeight: 48`, icon `21–22px`, nhãn `fs(11.5)` cấu hình `numberOfLines={1}`, `adjustsFontSizeToFit`, `minimumFontScale={0.8}`, và dấu chấm chỉ báo trạng thái đang chọn (`activeDot`: `4x4`, `borderRadius: 2`, `#456B58`).
  * **Chế độ Người cao tuổi (`ELDERLY` — 5 tabs):** *Trang chủ* (`home`), *AI* (`message-circle`), *Thuốc* (`pill`), *Điểm danh* (`check-square`), *Hồ sơ* (`user`).
  * **Chế độ Người chăm sóc (`CAREGIVER` — 4 tabs):** *Giám sát* (`activity`), *Cảnh báo* (`alert-triangle`), *Lịch thuốc* (`pill`), *Gia đình* (`users`).

---

## 3. Phân tích bố cục & thiết kế từng màn hình

### 3.1. Màn hình Chào mừng & Xác thực ([AuthScreen.tsx](file:///e:/mimamori/app/src/features/auth/AuthScreen.tsx))

Bố cục chia làm **2 lớp**: Màn hình giới thiệu (Welcome Landing) và Bottom Sheet Modal xác thực.

```text
+----------------------------------------+
| [Leaf Logo 38x38]  Mimamori AI         |  <- brandHeader (row)
|                                        |
| Chăm sóc kết nối.                      |  <- heroHeadline fs(28), weight 900
| Điểm tựa yêu thương.                   |  <- Màu #456B58
| Người bạn đồng hành AI chu đáo...      |  <- heroSubhead fs(14), #727C75
|                                        |
| +------------------------------------+ |
| |                                    | |
| |     [Ảnh cụ bà tưới cây]           | |  <- heroImageCard: height 280,
| |     (cover, borderRadius: 24)      | |     overflow: hidden, shadow.card
| |  +------------------------------+  | |
| |  | ☀ Sống an vui mỗi ngày       |  | |  <- heroBadgeOverlay (bottom:14, left:14)
| |  +------------------------------+  | |
| +------------------------------------+ |
|                                        |
| +----------+ +----------+ +----------+ |
| |  (♥)     | |  (👥)    | |  (🛡)    | |  <- valuePillarsRow (3 thẻ flex:1,
| | Thấu cảm | | Kết nối  | | Tự chủ   | |     gap: 8, radius: 18, padding: 12)
| | Hỗ trợ.. | | Gắn kết..| | Duy trì..| |
| +----------+ +----------+ +----------+ |
|                                        |
| +------------------------------------+ |
| |        Bắt đầu trải nghiệm         | |  <- getStartedButton (minHeight: 56, #456B58)
| +------------------------------------+ |
|     Đã có tài khoản? Đăng nhập ngay    |  <- signInLinkBtn
+----------------------------------------+
```

* **Bottom Sheet Modal (`modalCard`):** Trượt từ dưới lên (`animationType="slide"`), nền tối mờ `rgba(38, 51, 45, 0.6)`, bo góc trên `32px`, `maxHeight: '92%'`, bọc trong `KeyboardAvoidingView` (`padding` iOS / `height` Android).
  * **Thanh nắm trên (`modalTopBar`):** Thanh kéo `44x5` ở giữa, nút đóng tròn `32x32` bên phải.
  * **Hộp Demo nhanh (`demoBox`):** Nền `#F0ECE1`, bo `20px`, gồm 2 thẻ chọn vai trò ngang (`gap: 10`): *Người cao tuổi* (nền `#EDF6F0`, viền `#C9E5D4`) và *Người chăm sóc* (nền `#FEF6EC`, viền `#F9DDBE`).
  * **Bộ chuyển Tab (`tabToggleRow`):** Segmented pill *Đăng nhập* ↔ *Đăng ký tài khoản*.
  * **Form nhập liệu:** Các ô `inputContainer` (`minHeight: 48`, bo `14px`, nền `#F0ECE1`) kèm icon bên trái; khi ở chế độ Đăng ký có thêm cặp nút chọn vai trò ngang (`roleRow`: Người cao tuổi / Người chăm sóc).

---

### 3.2. Trang chủ Người cao tuổi ([ElderlyHomeScreen.tsx](file:///e:/mimamori/app/src/features/elderly/ElderlyHomeScreen.tsx))

Thiết kế theo luồng đọc từ trên xuống, ưu tiên khẩn cấp ở đầu và chia khối card rõ ràng (`paddingHorizontal: 18`, `paddingBottom: 110`):

```text
+----------------------------------------+
| Chào buổi sáng,             +--------+ |
| Ông Nguyễn Văn Ba           | Avatar | |  <- Avatar tròn 48x48, viền #456B58
| Hôm nay cụ cảm thấy thế nào?+--------+ |     (tự đồng bộ từ user.avatarUrl)
+----------------------------------------+
| [⚠] Cần trợ giúp khẩn cấp?             |  <- SOSButton (#FDF0F0, minHeight: 54)
|     Bấm để báo ngay cho người thân     |
+----------------------------------------+
| +------------------------------------+ |
| | [ĐIỂM DANH SỨC KHỎE]          ☺    | |  <- dailyWellnessCard (#F7EFE2,
| | Điểm danh hôm nay            (54px)| |     border #EBDDC5, radius: 24)
| | Chỉ mất 30 giây chia sẻ...         | |
| | [✓ Điểm danh ngay ->]              | |  <- Pill button (#456B58)
| +------------------------------------+ |
+----------------------------------------+
| Cụ muốn làm gì hôm nay?                |
| +----------+ +----------+ +----------+ |
| | (✓ xanh) | | (💊 đỏ)  | | (💬 cam) | |  <- actionsGrid: 3 cột × 2 hàng
| | Điểm danh| | Lịch thuốc| | Trợ lý AI| |     width: '31.5%', rowGap: 10,
| +----------+ +----------+ +----------+ |     icon circle 44x44 pastel riêng
| +----------+ +----------+ +----------+ |
| | (👤 x.dương)| |(Aa tím) | | (🕒 rêu) | |
| | Hồ sơ    | | Cỡ chữ   | | Lịch sử  | |
| +----------+ +----------+ +----------+ |
+----------------------------------------+
| Cữ thuốc sắp tới         Xem tất cả -> |
| +------------------------------------+ |
| | (💊) 08:00 - Sáng nay              | |  <- upcomingCard (radius: 20)
| |      Amlodipine 5mg                | |
| |      [✓ Đã uống cữ thuốc này]      | |
| +------------------------------------+ |
+----------------------------------------+
| +------------------------------------+ |
| | (☀) LỜI KHUYÊN SỨC KHỎE            | |  <- tipCard (#EEF4EF, border #D7E5D9)
| |     Một ly nước ấm vào buổi sáng...| |
| +------------------------------------+ |
+----------------------------------------+
```

---

### 3.3. Trợ lý Mimamori AI ([ElderlyCompanionScreen.tsx](file:///e:/mimamori/app/src/features/elderly/ElderlyCompanionScreen.tsx))

Bố cục khung chat toàn màn hình bọc trong `KeyboardAvoidingView` (`keyboardVerticalOffset: 70` trên iOS):

* **Top Bar cố định (`topBar`):** Nền `#FFFEFC` có đổ bóng nhẹ; bên trái là `AIAvatar` (`46px` kèm chấm xanh online), ở giữa là tên `Trợ lý Mimamori AI` + chấm trạng thái `greenPulse`, bên phải là pill `Giọng nói` (`#E6EEE7`).
* **Vùng hội thoại (`FlatList`):**
  * Khi trống (`ListEmptyComponent`): Hiển thị `AIAvatar 64px` căn giữa cùng lời chào thân thiện.
  * **Tin nhắn AI (`aiRow`):** Căn trái, avatar tròn nhỏ `28x28` bên trái, bong bóng nền trắng `#FFFEFC` viền `#EFEBE2` bo `18px` nhưng góc dưới-trái bo nhỏ `4px` tạo đuôi thoại (`maxWidth: '82%'`).
  * **Tin nhắn Cụ (`userRow`):** Căn phải, nền xanh sage `#456B58`, chữ trắng, góc dưới-phải bo nhỏ `4px`.
* **Dải gợi ý nhanh (`suggestionsContainer`):** Nền `#F0ECE1` ngay phía trên ô nhập, `ScrollView` cuộn ngang chứa 5 chip bo `14px` giúp người cao tuổi chạm là gửi ngay không cần gõ phím.
* **Thanh nhập liệu đáy (`inputArea`):** Bố cục 3 phần tử ngang (`gap: 10`): Nút Micro tròn `44x44` ↔ `TextInput` bo `20px` co giãn tối đa `maxHeight: 100` ↔ Nút Gửi tròn `44x44` (đổi màu xám `#E3DDD2` khi rỗng).

---

### 3.4. Quản lý & Lịch uống thuốc ([ElderlyMedicationScreen.tsx](file:///e:/mimamori/app/src/features/elderly/ElderlyMedicationScreen.tsx))

* **Top Bar & Bộ chuyển Tab:** Tiêu đề bên trái, nút pill `+ Thêm thuốc` bên phải; ngay dưới là Segmented Control 2 tab (*Lịch hôm nay* | *Lịch sử uống thuốc*).
* **Thẻ Tổng quan Tuân thủ (`healthOverviewCard`):**
  * Bố cục 2 cột: Bên trái là vòng tròn điểm tuân thủ (`circularScoreBox`: `74x74`, `borderRadius: 37`, viền xanh `2.5px`, nền `#E6EEE7`) hiển thị `%`; bên phải là 3 dòng chỉ số (`Đã uống`, `Còn chờ`, `Tổng cữ`).
* **Dòng thời gian uống thuốc (`timelineList`):**
  * Thiết kế dạng **Timeline 2 cột**: Cột trái `width: 32` gồm chấm tròn trạng thái `28x28` (xanh `#456B58` khi đã uống, viền xám khi chờ) nối với nhau bằng đường thẳng dọc `width: 2`; cột phải `flex: 1` là `medCard` (`borderRadius: 20`, `padding: 16`) chứa pill giờ uống, badge trạng thái (`StatusBadge`), hướng dẫn uống nền `#F0ECE1`, nút xác nhận toàn chiều ngang (`confirmFullBtn`) và nút ngừng thuốc.
* **Bottom Sheet Thêm thuốc mới (`modalCard`):** Bo góc trên `30px`, form gồm Tên thuốc, Liều dùng, Giờ uống kèm **4 pill chọn giờ nhanh** (`07:00`, `11:30`, `18:00`, `20:00`, `flexWrap: 'wrap'`), Cách dùng và cặp nút `Hủy` (`flex: 1`) / `Lưu lịch thuốc` (`flex: 2`).

---

### 3.5. Điểm danh Sức khỏe 4 bước ([ElderlyCheckInScreen.tsx](file:///e:/mimamori/app/src/features/elderly/ElderlyCheckInScreen.tsx))

Thiết kế dạng **Wizard từng bước (4 bước)** giảm tải nhận thức cho người cao tuổi:

* **Step Header:** Badge danh mục + tiến độ (`BƯỚC 1/4 • TÂM TRẠNG`), câu hỏi lớn `fontWeight: '800'`, phụ đề và thanh tiến trình ngang (`progressBar`: cao `6px`, bo `3px`, tự fill `25% → 100%`).
* **Danh sách lựa chọn (`optionsList`, `gap: 12`):** Mỗi bước có 4 thẻ lựa chọn (`optionCard`: `minHeight: 68`, `borderRadius: 20`, `padding: 16`, `borderWidth: 1.5`).
  * **Điểm nhấn thiết kế màu sắc:** Mỗi lựa chọn sở hữu một bộ màu riêng biệt (`iconBg`, `iconColor`, `iconBorder`, `cardActiveBorder`, `cardActiveBg`), ví dụ: *Vui vẻ* dùng tông hồng `#FFE4E6/#E11D48`, *Bình thường* dùng vàng hổ phách `#FEF3C7/#D97706`, *Hơi mệt* dùng cam `#FFEDD5/#EA580C`, *Buồn bã* dùng tím `#EDE9FE/#7C3AED`. Khi chọn, viền thẻ và nền thẻ đổi sang tông màu tương ứng và nút radio bên phải hiện dấu check.
* **Bước 4 & Điều hướng:** Bước 4 bổ sung ô ghi chú `multiline` (`minHeight: 80`). Hàng nút đáy chia tỷ lệ `1 : 2` (`Quay lại` | `Tiếp theo` / `Gửi điểm danh`).
* **Màn hình Hoàn tất (Screen 7 Celebratory View):**
  * Header có nút quay lại tròn `40x40` và pill `#3E5C4B` *Hoàn thành điểm danh*.
  * Cụm hoạt họa tĩnh trung tâm (`confettiArea`, `height: 180`): Vòng tròn xanh lá lớn `110x110` (`#75B884`) chứa dấu check trắng `54px`, xung quanh bố trí 6 cánh hoa màu vàng/cam/xanh xoay nghiêng góc `-50deg` đến `40deg`.
  * Thẻ tóm tắt `screen7SummaryCard` nền xanh thảo mộc `#EDF5EF` (bo `20px`) và nút `Về trang chủ` bo tròn `24px`.

---

### 3.6. Hồ sơ & Cài đặt Cá nhân ([ElderlyProfileScreen.tsx](file:///e:/mimamori/app/src/features/elderly/ElderlyProfileScreen.tsx))

Quản lý 4 màn hình con (`currentSubView`) với thống nhất `paddingHorizontal: 18`, `paddingBottom: 120`:

1. **`main` (Hồ sơ chính):**
   * **Top Header:** Nút bánh răng `38x38` bên trái (mở Cài đặt hiển thị), tiêu đề *Hồ sơ* căn giữa.
   * **Profile Hero Row:** Avatar tròn `68x68` viền `2px` (`#456B58`), cột tên + `@username • SĐT` + pill `Người cao tuổi`, và nút bút chì `32x32` bên phải.
   * **Menu Card (`borderRadius: 20`):** 6 dòng cài đặt có hộp icon `32x32` tròn nền `#F3F6F4`; dòng *Người thân kết nối* có cụm mini-avatar `20x20` xếp chồng nhau (`marginLeft: -6`, viền trắng `1.5px`).
   * **Cuối trang:** Nút *Đăng xuất* nền hồng nhạt `#FDE8E8` chữ đỏ `#C53030` bo `20px`, và thẻ chuyển vai trò Demo tím nhạt `#F5F3FF`.

2. **`personalInfo` (Thông tin cá nhân & Đổi Avatar):**
   * **Lưới chọn Avatar 2×2 (`avatarPickerRow`):** `flexWrap: 'wrap'`, `justifyContent: 'space-between'`, `rowGap: 12`. Mỗi ô `width: '48%'`, nền `#F0ECE1`, bo `16px`, viền `2px` (đổi sang `#456B58` và nền `#E6EEE7` khi chọn), chứa ảnh tròn `64x64`, badge check `20x20` ở góc phải trên và nhãn căn giữa.
   * **Form Hồ sơ:** Gồm Họ và tên (`*`), Tên tài khoản (khóa `editable={false}`, nền `#F3F4F6`, badge `Mặc định`, 1 dấu `@`), Số điện thoại cụ, Số điện thoại khẩn cấp (icon đỏ), dòng Vai trò và nút `Lưu thông tin cá nhân`.

3. **`displaySettings` (Cài đặt hiển thị & Cỡ chữ):**
   * **Thẻ xem trước trực tiếp (`livePreviewCard`):** Nền kem sáng `#FFFBF4`, viền `#EFE8D8`, chữ thay đổi kích thước theo thời gian thực khi chạm thanh trượt.
   * **Thanh trượt 4 nấc (`sliderContainer`):** Thanh ngang `sliderTrackLine` (`height: 2.5px`, `#D1D5DB`) đi qua 4 nút tròn (`14x14` xám khi chưa chọn, phóng lớn thành `24x24` xanh sage có lõi trắng `8x8` khi đang chọn).
   * **2 Công tắc (`Switch`):** *Tăng độ tương phản* và *Chế độ ban đêm* với màu track `#456B58`.

4. **`securityPrivacy` (Bảo mật & Quyền riêng tư):**
   * Segmented Tab 2 chế độ (*Đổi mật khẩu* | *Quên mật khẩu*), các ô mật khẩu có nút con mắt (`eye`/`eye-off`) ẩn/hiện, và khung cam kết bảo mật y tế nền xanh nhạt `#F0FDF4` viền `#BBF7D0`.

---

### 3.7. Phân hệ Người chăm sóc (`src/features/caregiver/`)

| Màn hình | Bố cục & Các khối thiết kế chính |
| :--- | :--- |
| **[CaregiverDashboardScreen.tsx](file:///e:/mimamori/app/src/features/caregiver/CaregiverDashboardScreen.tsx)** | • **Top Header:** Logo lá `34x34`, tiêu đề chào, nút pill `Cập nhật` bên phải.<br>• **Thanh chọn người thân (`ScrollView` ngang):** Các pill `maxWidth: 260` (viền `#456B58` nền `#E6EEE7` khi đang chọn).<br>• **Banner người cao tuổi (`elderlyCard`):** Avatar tròn `48x48`, tên/SĐT, Status Badge ngữ nghĩa bên phải (`maxWidth: '45%'`, đổi 4 màu theo trạng thái `NORMAL` → `CRITICAL`).<br>• **Lưới 2 cột KPI (`metricsRow`, `gap: 12`):** Trái là thẻ *Uống thuốc* (`22px` đậm + thanh tiến độ `progressBarFill` `6px`); phải là thẻ *Điểm danh* (tâm trạng + thể trạng).<br>• **Các Section Card (`borderRadius: 20`):** Danh sách thuốc (chấm trạng thái `24x24` + badge giờ), Cảnh báo đang mở (thẻ nền đỏ `#FDF0F0`), và Hộp tóm tắt AI nền `#F0ECE1`. |
| **[CaregiverAlertsScreen.tsx](file:///e:/mimamori/app/src/features/caregiver/CaregiverAlertsScreen.tsx)** | • **Header cố định nền trắng:** Tiêu đề, phụ đề và Segmented Filter 2 nút (*Chưa xử lý* \| *Tất cả*).<br>• **Danh sách Card cảnh báo (`borderRadius: 16`, `padding: 16`):** Hàng đầu gồm Badge mức độ (`KHẨN CẤP`, `MỨC ĐỘ CAO`, `TRUNG BÌNH`, `THÔNG TIN`) + giờ bên phải; tiêu đề + mô tả; nút `Xác nhận đã kiểm tra & xử lý` hoặc badge `Đã xử lý xong` (card đã xử lý giảm `opacity: 0.65`). |
| **[CaregiverFamilyScreen.tsx](file:///e:/mimamori/app/src/features/caregiver/CaregiverFamilyScreen.tsx)** | • **Profile Card căn giữa:** Avatar tròn `64x64`, tên, `@username`, pill vai trò.<br>• **Thẻ danh sách người thân (`sectionCard`):** Nút `+ Thêm liên kết` ở góc phải; mỗi thành viên là `memberCard` nền `#F0ECE1` bo `16px` có tag `Đã kết nối an toàn`.<br>• **Nút chuyển vai trò & Đăng xuất:** Nút chuyển sang Demo Người cao tuổi (`#456B58`) và nút Đăng xuất (`#FDF0F0`).<br>• **Center Dialog Modal (`borderRadius: 24`):** Bọc `KeyboardAvoidingView`, nhập `elderlyUsername` và `relationship`, cặp nút Hủy / Tạo kết nối. |

---

## 4. Thiết kế các Components dùng chung (`src/components/`)

| Component | Thông số hình dáng & hành vi thiết kế |
| :--- | :--- |
| [AIAvatar.tsx](file:///e:/mimamori/app/src/components/AIAvatar.tsx) | Vòng tròn nền `#F0ECE1`, viền `1.5px` `#456B58`, icon lá kích thước `65%` đường kính, chấm online `#326847` (`10px` hoặc `14px` nếu `size >= 60`) viền trắng `2px`. |
| [AppHeader.tsx](file:///e:/mimamori/app/src/components/AppHeader.tsx) | Bố cục hàng ngang (`paddingHorizontal: 18`), badge `MIMAMORI` nền `#E6EEE7` + ngày `vi-VN`, tiêu đề `fs(22)` đậm `800`, bên phải là nút avatar chữ cái đầu hoặc `rightAction`. |
| [PrimaryButton.tsx](file:///e:/mimamori/app/src/components/PrimaryButton.tsx) & [SecondaryButton.tsx](file:///e:/mimamori/app/src/components/SecondaryButton.tsx) | `minHeight: 50–52`, bo góc `16px`, `paddingHorizontal: 20`, `paddingVertical: 10`; chữ dùng `flexShrink: 1`, `textAlign: 'center'` để tự xuống dòng gọn nếu cỡ chữ `xlarge`. |
| [SectionHeader.tsx](file:///e:/mimamori/app/src/components/SectionHeader.tsx) | Thanh nhấn dọc `4x18` (`borderRadius: 2`, `#456B58`) bên trái tiêu đề, nút thao tác phải có vùng chạm `minHeight: 44`. |
| [StatusBadge.tsx](file:///e:/mimamori/app/src/components/StatusBadge.tsx) | Pill `borderRadius: 10`, viền `1px`, `maxWidth: '100%'`, hỗ trợ 2 kích thước (`small` / `medium`) và 5 bộ màu ngữ nghĩa. |
| [EmptyState.tsx](file:///e:/mimamori/app/src/components/EmptyState.tsx) | Card trắng bo `24px`, vòng tròn icon `64x64` nền `#F0ECE1`, tiêu đề `fs(18)`, mô tả căn giữa và nút CTA tùy chọn. |
| [SOSButton.tsx](file:///e:/mimamori/app/src/components/SOSButton.tsx) | Pill ngang `minHeight: 54`, nền `#FDF0F0`, viền `1.5px` `#F6C8C8`, vòng tròn tam giác đỏ `38x38`. Khi bấm mở Modal căn giữa (`maxWidth: 360`, bo `28px`, `padding: 24`) có vòng tròn icon cảnh báo `68x68` và 2 nút dọc chống bấm nhầm. |

---

## 5. Quy chuẩn chống tràn khung & Co giãn đáp ứng (Responsive Rules)

Toàn bộ giao diện đã áp dụng bộ quy chuẩn layout thống nhất để không vỡ khung trên màn hình nhỏ (`360px`) hay khi người cao tuổi bật cỡ chữ `Rất lớn (130%)`:

1. **Chống tràn chữ theo chiều ngang:** Mọi cột chữ nằm cạnh icon/badge trong `flexDirection: 'row'` đều dùng `flex: 1`, `minWidth: 0` và `flexShrink: 1` trên `<Text>` để tự động ngắt dòng thay vì tràn khỏi viền card.
2. **Lưới đa cột an toàn:** Grid avatar dùng `flexWrap: 'wrap'` + `width: '48%'` (`justifyContent: 'space-between'`); grid thao tác nhanh trang chủ dùng `width: '31.5%'` thay cho chiều rộng cố định bằng pixel.
3. **Chống thanh Bottom Navigation che nút cuối:** Mọi màn hình cuộn đều thiết lập `paddingBottom` từ `100px` đến `120px` trên `contentContainerStyle`.
4. **Tránh bàn phím che ô nhập:** Các màn hình chat và form modal (`AuthScreen`, `ElderlyMedicationScreen`, `CaregiverFamilyScreen`, `ElderlyCompanionScreen`) đều bọc `KeyboardAvoidingView` kèm `keyboardShouldPersistTaps="handled"`.
