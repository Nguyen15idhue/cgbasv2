# KẾ HOẠCH DỌN DẸP FILE THỪA/ RÁC

## 1. FILE LOG RUNTIME (MUST DELETE)

| File | Lý do |
|------|-------|
| `logs/app-2026-03-31.log` | Log runtime, không commit |
| `logs/error-2026-03-31.log` | Log lỗi runtime |
| `logs/.0b0c1f...-audit.json` | Winston audit log |
| `logs/.56f79f...-audit.json` | Winston audit log |

---

## 2. FOLDER DEMO - CHỨA SECRETS (MUST DELETE)

| File | Lý do |
|------|-------|
| `demo/config.js` | Hardcoded appId, appSecret, ACCESS_KEY, SECRET_KEY |
| `demo/index.js` | Demo server thử nghiệm OAuth |
| `demo/token.json` | File token demo |
| `demo/package.json` | Dependencies demo (koa, open) |

---

## 3. TÀI LIỆU TRÙNG LẶP (MUST DELETE)

| File | Lý do |
|------|-------|
| `docs/CLEANUP-SUMMARY.md` | Tổng kết cleanup, đã xong |
| `docs/UPDATE-EWELINK-TOKEN.md` | Trùng EWELINK_TOKEN_REFRESH.md |
| `docs/DEPLOY_VPS_SAFE_MYSQL.md` | Trùng DEPLOY_VPS.md |
| `docs/USER-GUIDE.html` | Generated từ USER-GUIDE.md |
| `docs/plans/` | Thư mục trống |

---

## 4. FILE TEST THỬ NGHIỆM (OPTIONAL)

| File | Lý do |
|------|-------|
| `test-ewelink.js` | Script test 460 dòng, nên chuyển scripts/ |
| `test-ewelink-vps.sh` | Wrapper script test |

---

## 5. TÀI LIỆU RÚT GỌN TRÙNG LẶP (OPTIONAL)

| File | Trùng với |
|------|-----------|
| `QUICK-GUIDE-VPS.md` | DEPLOY_VPS.md |
| `VPS-UPDATE-QUICK.md` | DEPLOY_VPS.md |
| `README-DOCKER.md` | DOCKER_GUIDE.md |
| `docs/ARCHITECTURE-DIAGRAM.md` | ARCHITECTURE-SPA.md |
| `docs/EWELINK_OAUTH.md` | EWELINK_TOKEN_REFRESH.md |
| `Open_API_Document.pdf` | File PDF bên thứ 3 |

---

## 6. FILE CẦN FIX

| File | Vấn đề |
|------|--------|
| `.gitignore` | Thiếu rule: `logs/`, `*.log`, `demo/`, `.vscode/` |
| `.env.example` | Sai tên biến so với .env thực tế |

---

## 7. TỔNG KẾT

| Loại | Số file | Hành động |
|------|---------|-----------|
| MUST DELETE | 10 file + 1 folder | Xóa ngay |
| MUST FIX | 2 file | Sửa lại |
| OPTIONAL | 6 file | Xem xét |

---

## 8. SAU KHI DỌN DẸP

- Update INDEX.md (xóa link đến file đã xóa)
- Update .gitignore
- Fix .env.example
- Commit tất cả thay đổi
