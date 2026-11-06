# Progress

## Latest Session

**Date:** 2026-11-06T15:57:25Z
**Verify:** PASS
**Detail:** Tất cả queue đã xong; web chạy tại https://mta.thinhdhm.id.vn/teacher-bot/

### Handoff

Xong toàn bộ: FEAT-001..004, TASK-001 (systemd + nginx, đã kiểm tra qua HTTPS: login, cookie Secure, SSE streaming qua nginx, AI thật trả lời), TASK-002 (lớp 2), TASK-003 (lớp 12). Queue trống. Vận hành: `systemctl --user status|restart teacher-bot`, cấu hình ở ~/.config/teacher-bot.env, admin ở /teacher-bot/admin, dữ liệu ở data/. Còn vài hồ sơ thử (tên Test, Minh, Lan, KiemTraNginx) trong data/teacher-bot.db do lúc kiểm tra tạo ra, chờ chủ dự án duyệt xoá.

---

## History

- 2026-11-06 — PASS — FEAT-001..004, TASK-001..003 hoàn tất, web đã lên domain

