# Thiết Kế Chi Tiết: Web App Yêu Lại Tiếng Anh

> **Ngày tạo:** 03/07/2026
> **Trạng thái:** Đã được duyệt thiết kế sơ bộ bởi Anh Trung
> **Người thực hiện:** Julie (Trợ lý AI)

---

## 1. Tổng Quan Dự Án
Web App **Yêu Lại Tiếng Anh** là ứng dụng hỗ trợ học tập dành riêng cho học viên tham gia thử thách **"15 Ngày Thụ Đắc Ngôn Ngữ"**. Ứng dụng giúp số hóa lộ trình học, cho phép học viên đọc truyện tương tác trực tiếp, nghe âm thanh bản xứ, tra cứu từ vựng tức thì, lưu từ để ôn tập và ghi nhận thói quen kỷ luật mỗi ngày.

- **Nền tảng:** Web Application (Tương thích tốt trên Mobile và Desktop).
- **Mục tiêu chính:** Nâng cao trải nghiệm học tập, đồng bộ tiến độ học trên các thiết bị, tăng tỷ lệ hoàn thành thử thách 15 ngày.

---

## 2. Công Nghệ Sử Dụng
Để ứng dụng nhẹ, mượt và chạy trực tiếp không cần cài đặt môi trường phức tạp:
1. **Frontend:**
   - HTML5 & CSS3 thuần với thiết kế giao diện tối tân, hỗ trợ Dark Mode cao cấp (Glassmorphism).
   - Javascript thuần (ES6) để điều hướng các màn hình (Single Page Application) và xử lý tương tác.
   - Google Fonts: **Outfit** cho tiêu đề và **Inter** cho văn bản đọc truyện.
2. **Backend & Cơ sở dữ liệu:**
   - **Supabase Client SDK:** Quản lý hệ thống Đăng nhập / Đăng ký (Authentication) và lưu trữ cơ sở dữ liệu trên đám mây.
3. **Lưu trữ dữ liệu tĩnh:**
   - Nội dung 5 cuốn truyện và liên kết file audio phát âm được lưu trực tiếp trong code frontend (`books.js`) giúp app tải trang tức thì.

---

## 3. Kiến Trúc Dữ Liệu (Supabase Database Schema)

### Bảng `profiles` (Thông tin học viên)
Liên kết trực tiếp với bảng `auth.users` của Supabase:
```sql
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  current_day integer default 1, -- Ngày học hiện tại (từ 1 đến 15)
  streak integer default 0,      -- Chuỗi ngày học liên tục
  longest_streak integer default 0, -- Chuỗi ngày học dài nhất đạt được
  last_active timestamp with time zone default timezone('utc'::text, now())
);
```

### Bảng `vocabulary` (Kho từ vựng đã lưu)
Lưu trữ các từ vựng học viên đã đánh dấu khi đọc truyện:
```sql
create table public.vocabulary (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  word text not null,            -- Từ tiếng Anh gốc
  definition text not null,      -- Nghĩa tiếng Việt tương ứng
  context text,                  -- Câu ví dụ chứa từ đó trong truyện
  story_title text,              -- Tên truyện chứa từ đó
  day integer,                   -- Ngày học lưu từ
  created_at timestamp with time zone default timezone('utc'::text, now())
);
```

### Bảng `habit_history` (Nhật ký check-in 15 ngày)
Ghi chép lịch sử hoàn thành bài học mỗi ngày:
```sql
create table public.habit_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  day integer not null,          -- Ngày check-in (1 đến 15)
  completed_at timestamp with time zone default timezone('utc'::text, now()),
  unique (user_id, day)          -- Mỗi học viên chỉ được check-in 1 lần/ngày học
);
```


---

## 4. Cấu Trúc Các Màn Hình & Bố Cục (Layouts)

Ứng dụng là dạng Single Page Application (SPA), chuyển đổi mượt mà giữa các section thông qua ID bằng Javascript:

1. **Màn hình Đăng nhập / Đăng ký:**
   - Thiết kế tinh giản với các trường: Email, Mật khẩu, Họ tên (khi đăng ký).
   - Có nút chuyển đổi nhanh giữa Đăng nhập và Đăng ký.
2. **Trang chủ (Dashboard):**
   - **Header:** Hiển thị tên học viên + icon Streak lửa 🔥 phát sáng kèm số ngày liên tiếp.
   - **Progress Bar:** Tiến độ hoàn thành tổng thể thử thách 15 ngày.
   - **Roadmap:** Danh sách 15 thẻ bài học nối tiếp nhau từ Ngày 1 đến Ngày 15. Ngày đã học sáng xanh lá cây; ngày hiện tại phát sáng xanh dương có hiệu ứng vẫy gọi; ngày chưa học bị khóa mờ.
3. **Giao diện Đọc truyện tương tác:**
   - **Header:** Nút Back quay lại Dashboard + Tiêu đề ngày học + Trình phát audio ghim cố định.
   - **Nội dung sách:** Văn bản tiếng Anh căn giữa, font chữ lớn, giãn dòng rộng. Mỗi từ tiếng Anh có thể click được.
   - **Bong bóng tra từ (Tooltip):** Khi click vào từ, tooltip kính mờ hiện ra chứa: nghĩa tiếng Việt, nút **Lưu từ (Save) ⭐** và nút **Phát âm 🔊** (sử dụng Web Speech API).
   - **Footer:** Nút **"Hoàn thành ngày học"** to, nổi bật ở cuối bài đọc.
4. **Kho từ vựng đã lưu:**
   - Hiển thị danh sách từ đã lưu dạng thẻ ghi nhớ (Flashcards).
   - Mỗi thẻ cho phép click để xem nghĩa tiếng Việt và câu ngữ cảnh ví dụ.
   - Có nút loa phát âm và nút **Đã thuộc 🗑️** để xóa từ ra khỏi danh sách.
5. **Nhật ký Thói quen (Habit Tracker):**
   - Biểu đồ 15 ô vuông (giống lưới commit GitHub) hiển thị lịch trình 15 ngày. Ô nào đã hoàn thành sẽ sáng lên màu xanh ngọc lục bảo.

---

## 5. Quy Trình Xác Minh & Kiểm Thử
1. **Kiểm tra Authentication:** Đảm bảo đăng ký, đăng nhập và đăng xuất qua Supabase hoạt động trơn tru.
2. **Kiểm tra tương tác đọc truyện:** Click vào từ tiếng Anh bất kỳ phải hiện đúng nghĩa tiếng Việt và hiển thị popup tra cứu.
3. **Kiểm tra lưu từ:** Bấm lưu từ phải ghi nhận chính xác dữ liệu vào Supabase và hiển thị trong màn hình Kho từ vựng.
4. **Kiểm tra check-in:** Bấm hoàn thành ngày học phải cập nhật đúng `current_day` trong profile, thêm bản ghi check-in và mở khóa ngày học tiếp theo trên Dashboard.
