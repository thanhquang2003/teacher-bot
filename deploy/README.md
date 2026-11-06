# Triển khai

1. `~/.config/teacher-bot.env` (chmod 600):
   ```
   PORT=8791
   BASE_PATH=/teacher-bot
   COOKIE_SECURE=1
   ADMIN_PASSWORD=<mật khẩu admin>
   ```
2. `cp deploy/teacher-bot.service ~/.config/systemd/user/ && systemctl --user daemon-reload && systemctl --user enable --now teacher-bot`
3. Thêm `deploy/nginx-teacher-bot.conf` vào server block của domain, kiểm tra và reload nginx.
4. Claude Code trên VPS phải đã đăng nhập (`claude` → /login) bằng tài khoản subscription; dữ liệu nằm trong `data/` (SQLite + ảnh).
5. Đổi nguồn AI khi hết limit: `https://mta.thinhdhm.id.vn/teacher-bot/admin`.
