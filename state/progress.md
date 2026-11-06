# Progress

## Latest Session

**Date:** 2026-11-06T14:46:22Z
**Verify:** PASS
**Detail:** FEAT-001..004 done và merged (PR #1-#5); service teacher-bot chạy cổng 8791; chờ nginx.

### Handoff

Web đã xong và chạy: `systemctl --user status teacher-bot` (cổng 127.0.0.1:8791, base path /teacher-bot, env ở ~/.config/teacher-bot.env). 31 test pass, CI xanh. Đã thử thật claude CLI (có ảnh) qua admin "Hỏi thử".
TASK-001 còn đúng một việc: thêm `deploy/nginx-teacher-bot.conf` vào server block của mta.thinhdhm.id.vn rồi `sudo nginx -t && sudo systemctl reload nginx`. BLOCKER: file /etc/nginx/sites-available/mta.thinhdhm.id.vn thuộc root (640) và user aiteam không có sudo không mật khẩu. Sau khi nginx xong: kiểm tra https://mta.thinhdhm.id.vn/teacher-bot/ rồi `lah done TASK-001`.

---

## History

