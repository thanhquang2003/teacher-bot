# Teacher-bot — thiết kế

## Mục đích
Web học tập cho các con của chủ dự án (lớp 5, lớp 6, lớp 9, đại học). AI giảng cách giải bằng ngôn ngữ hợp với lớp, luôn hướng tới việc người học hiểu, không làm bài hộ.

## Mục tiêu
- Nhiều người dùng, mỗi người có hồ sơ (tên + lớp) và nhiều phiên học như chat.
- Lần đầu hỏi tên + lớp; các lần sau tự nhận diện trên máy đã vào. Có nút đăng xuất để người khác vào.
- Gửi được chữ và ảnh (chụp bài tập).
- Trả lời hiện dần (streaming), dùng tốt trên điện thoại.
- Chạy tại `https://mta.thinhdhm.id.vn/teacher-bot`.
- AI qua lớp trung gian: mặc định Claude Code (subscription) trên VPS, admin đổi được sang Codex CLI hoặc Anthropic API key.

## Không làm / tránh
- Không đưa đáp án cuối ngay; không có mật khẩu người dùng (hộ gia đình).
- Không đụng các site khác trong nginx.

## Quyết định của chủ dự án
- Ưu tiên subscription; hết limit thì admin chuyển Codex/API key (cấu hình sau).
- Admin = chủ dự án, mật khẩu trong biến môi trường `ADMIN_PASSWORD`, trang `/teacher-bot/admin`.
- Vào lại bằng tên + lớp; hồ sơ giữ lại sau khi đăng xuất.

## Lựa chọn của người xây (có thể đổi)
- Node.js 22 + Express, SQLite (`node:sqlite`/better-sqlite3), frontend HTML/JS thuần, không build step.
- Cookie thiết bị dài hạn (httpOnly, 1 năm). Streaming bằng SSE.
- Hàng đợi: tối đa N (mặc định 2) lượt gọi AI đồng thời, còn lại chờ.
- Hết limit: học sinh thấy thông báo thân thiện; admin thấy lỗi thật.
- Ảnh lưu trên đĩa (giới hạn kích thước/loại), đưa cho CLI qua đường dẫn tệp.
- Prompt hệ thống theo lớp (5 / 6 / 9 / đại học), kiểu Socratic: hỏi gợi mở, giảng từng bước, cho bài tương tự.
- Cổng nội bộ 8791, chạy bằng systemd; nginx proxy `/teacher-bot/`.
