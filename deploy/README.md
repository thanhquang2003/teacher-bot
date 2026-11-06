# Triển khai

1. `~/.config/teacher-bot.env` (chmod 600):
   ```
   PORT=8791
   BASE_PATH=/teacher-bot
   COOKIE_SECURE=1
   ADMIN_PASSWORD=<mật khẩu admin>
   ```
2. `cp deploy/teacher-bot.service ~/.config/systemd/user/ && systemctl --user daemon-reload && systemctl --user enable --now teacher-bot`
3. Chạy `sudo bash deploy/install-nginx.sh` (sao lưu, chèn include vào server block 443 của domain, `nginx -t`, tự khôi phục nếu lỗi, rồi reload).
4. Claude Code trên VPS phải đã đăng nhập (`claude` → /login) bằng tài khoản subscription; dữ liệu nằm trong `data/` (SQLite + ảnh).
5. Đổi nguồn AI khi hết limit: `https://mta.thinhdhm.id.vn/teacher-bot/admin`.
