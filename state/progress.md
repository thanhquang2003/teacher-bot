# Progress

## Latest Session

**Date:** 2026-11-08T04:10:00Z
**Verify:** PASS
**Detail:** TASK-004 xong (PR #9); web chạy tại https://mta.thinhdhm.id.vn/teacher-bot/

### Handoff

TASK-004 (PR #9): gia sư học sinh dẫn dắt tối đa 3 lượt rồi giải trọn vẹn; thêm hồ sơ phụ huynh (hỏi lớp của con: 2 hoặc 5, không hỏi đáp, chỉ giảng + cách giải + cách nói với con). DB có cột profiles.role (tự migrate). Đã restart service. Nhánh local task/TASK-00x còn tồn, chờ duyệt xoá (hook chặn branch -D). Trước đó xong: FEAT-001..004, TASK-001 (systemd + nginx, đã kiểm tra qua HTTPS: login, cookie Secure, SSE streaming qua nginx, AI thật trả lời), TASK-002 (lớp 2), TASK-003 (lớp 12). Queue trống. Vận hành: `systemctl --user status|restart teacher-bot`, cấu hình ở ~/.config/teacher-bot.env, admin ở /teacher-bot/admin, dữ liệu ở data/. Còn vài hồ sơ thử (tên Test, Minh, Lan, KiemTraNginx) trong data/teacher-bot.db do lúc kiểm tra tạo ra, chờ chủ dự án duyệt xoá.

---

## History

- 2026-11-08 — PASS — TASK-004: tối đa 3 bước hỏi đáp + hồ sơ phụ huynh lớp 2/5
- 2026-11-06 — PASS — FEAT-001..004, TASK-001..003 hoàn tất, web đã lên domain

