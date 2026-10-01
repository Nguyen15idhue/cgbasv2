# 01 — Lịch Sử Tắt/Bật: Drill-down Thành công/Thất bại + Popup Log

> Trang Cấu hình → Lịch Sử Thực Hiện: ấn vào số Thành công/Thất bại của từng record
> → popup bảng (STT, Tên trạm, Trạng thái, Thời gian, 👁 View log)
> → popup con xem chi tiết tại sao thất bại / thành công có bật trạm thật không.

## 0. Bối cảnh & ràng buộc (đã xác minh từ mã nguồn)

- `scheduled_shutdown_history` chỉ lưu tổng hợp (`total/successful/failed`) — `src/migrations/010_create_scheduled_shutdown.sql:29-40`.
- Chi tiết từng trạm nằm ở `scheduled_shutdown_labels` nhưng **bị xóa sau mỗi lần chạy**
  (`src/services/scheduledShutdownService.js:451`, các nhánh hủy/lỗi `:354,389,406,469`).
  → Bản ghi cũ (vd 30/9) đã mất chi tiết vĩnh viễn, UI phải xử lý "không có dữ liệu chi tiết".
- "Thành công" hiện tại = eWeLink API trả `error===0` (`scheduledShutdownService.js:216-228,262-271`
  qua `ewelinkService.js:316-326`), **không verify trạm online lại**.
- Dòng `/history` (`station_recovery_history`) chỉ sinh ra khi auto-recovery chạy
  (`stationControlService.js`, `routes/stationRoutes.js:729`) — shutdown không ghi vào đó.
- Test FE dùng **Playwright** (`@playwright/test`, chạy Chromium, baseURL `http://localhost:3001`).

## Bước 1 — Migration `017_create_shutdown_details.sql`

### Yêu cầu cần đạt
- [ ] Tạo bảng `scheduled_shutdown_details`: `id, history_id FK→history.id ON DELETE CASCADE,
      station_id, device_id, shutdown_ok BOOL, shutdown_error TEXT, shutdown_at DATETIME NULL,
      poweron_ok BOOL, poweron_error TEXT, poweron_at DATETIME NULL,
      final_status ENUM('completed','failed','skipped'), created_at`.
- [ ] Index `(history_id, final_status)`.
- [ ] File được `src/migrations/index.js` tự nhận (đặt tên `017_*.sql`, chạy thử migration local OK).
- [ ] Không sửa bảng cũ.

### Checklist test
- [ ] `npm run dev` boot log có dòng `Thực thi migration: 017_... (Thành công)`.
- [ ] `SHOW TABLES LIKE 'scheduled_shutdown_details'` = 1 bảng.
- [ ] Chạy migration 2 lần không lỗi (idempotent qua bảng `migrations`).
- [ ] Playwright: chưa cần (bước DB thuần).

### Kết quả test
- [x] Đã chạy / Ngày: 01/10/2026, Người chạy: AI + chủ dự án giám sát, Kết quả: **PASS**
  - Boot 1: log `Thực thi migration: 017_create_shutdown_details.sql (Thành công)`.
  - `SHOW TABLES LIKE 'scheduled_shutdown_details'` = 1; đủ 12 cột + UNIQUE `(history_id,station_id)` + INDEX `(history_id,final_status)` + FK CASCADE.
  - Boot 2: log `017 ... Đã chạy trước đó (Bỏ qua)` — idempotent.
  - Không cần FE.

### Ghi chú (Bước 1)
- `history_id` NOT NULL + FK CASCADE: history row luôn tạo trước (`execute():319`) nên FK bắt buộc được; xóa history cũ kéo theo details.
- Comment trong file migration để ASCII (không dấu) để tránh rủi ro encoding khi runner đọc file;
  label tiếng Việt có dấu chỉ dùng ở UI/log.
- Giữ ~31 dòng/ngày; thêm retention ở Bước 7.

## Bước 2 — Service ghi details trong `execute/shutdownBatch/poweronBatch`

### Yêu cầu cần đạt
- [ ] `shutdownBatch`/`poweronBatch` nhận thêm `historyId`, sau mỗi trạm vừa update label
      vừa upsert `details` (1 row/trạm/lần chạy, update dần 2 pha tắt → bật).
- [ ] Trạm tắt lỗi (`failed`) bị bỏ qua ở pha bật (giữ nguyên `WHERE status IN ('waiting_poweron','powering_on')`
      ở `:412-418`) nhưng details ghi `final_status='failed'`, `poweron_*=NULL`, lý do `skipped_poweron_after_shutdown_fail`.
- [ ] Nhánh hủy (`cancel()`) và catch lỗi persist partial details **trước** `DELETE labels`.
- [ ] Không đổi logic auto-recovery (vẫn join labels như `autoMonitor.js:59`, `stationControlService.js:135`).
- [ ] `final_status` tổng hợp cuối (`:433-448`) đọc từ details thay vì labels càng tốt (1 nguồn sự thật),
      nhưng tối thiểu phải khớp số với labels.

### Checklist test
- [ ] Chạy tay `POST /api/scheduled-shutdown/execute` (giờ test, 2-3 trạm map) → `details` có đủ row,
      `shutdown_at/poweron_at` đầy đủ, lỗi ghi nguyên văn (vd `设备控制失败1`).
- [ ] Hủy giữa chừng (`POST .../cancel`) → details partial còn lại, labels đã xóa.
- [ ] Unit thủ công: trạm tắt lỗi không bị bật lại, details ghi rõ skipped.
- [ ] Playwright: chưa cần.

### Kết quả test
- [x] Đã chạy / Ngày: 01/10/2026, Người chạy: AI + chủ dự án giám sát, Kết quả: **PASS (10/10)**
  - `node --check` sạch; restart app boot bình thường, scheduler + eWeLink (82 devices) OK.
  - Script kiểm thử trong container với device giả (`ffffffffffff`, không chạm thiết bị thật):
    shutdown-ok-only→skipped, shutdown-fail→failed, untouched→failed, cancel→skipped,
    đủ 2 pha→completed, `shutdownBatch` fake trả `success=false` + persist `shutdown_ok=0` + giữ nguyên văn lỗi,
    normalize→failed, cleanup CASCADE sạch (`leftover_details=0, leftover_labels=0`).
  - Nhánh hủy thật (`cancel()` giữa execute) không chạy live vì sẽ cắt điện 31 trạm thật —
    đã review code: cả 3 điểm return-hủy đều `normalizeDetails(...,'skipped')` trước `DELETE labels`.

### Ghi chú
- `toggleChannel` retry 5 lần (`utils/helper.js:10-25`): chỉ lưu kết quả cuối + `error_message` cuối,
  không lưu từng lần retry (tránh phình DB).
- Cẩn thận `execute()` chạy 2 pha cách nhau `shutdown_duration_minutes`: upsert theo
  `(history_id, station_id)` UNIQUE.

## Bước 3 — API đọc details

### Yêu cầu cần đạt
- [ ] `GET /api/scheduled-shutdown/history/:id/details?status=completed|failed`
      (sau `requireAuth`), join `details + stations` trả `station_name`, sắp xếp theo tên trạm.
- [ ] `GET /api/scheduled-shutdown/history/:id` (1 record) nếu chưa có — phục vụ tiêu đề popup.
- [ ] Bản ghi cũ không có details → trả `data: []` + flag `has_details: false` (không 404).
- [ ] Response gộp sẵn timeline mỗi trạm (4 mốc giờ + 2 lỗi) để popup con không cần gọi thêm.

### Checklist test
- [ ] curl/API: `history/205/details` (bản ghi cũ) → `[] + has_details:false`.
- [ ] curl/API: bản ghi mới → đủ 31 row, filter `?status=failed` đúng tập con.
- [ ] Chưa login → 401; sai id → 404/[] có kiểm soát.
- [ ] Playwright API: `request.get` 2 case trên assert shape JSON.

### Kết quả test
- [x] Đã chạy / Ngày: 01/10/2026, Người chạy: AI + chủ dự án giám sát, Kết quả: **PASS (8/8)**
  - Seed history 24 (3 details đủ completed/failed/skipped) + history 25 kiểu cũ (không details), dọn sạch sau test (`orphan_details=0`, dữ liệu thật còn nguyên).
  - Không login → 401; `GET /history/24` → đủ trường; `/details` → `has_details=true`, 3 dòng đúng thứ tự;
    `?status=failed` → đúng 1 dòng trạm 16; bản ghi cũ → `has_details=false, data=[]`;
    `status=bogus` → 400; id không tồn tại → 404.
  - Item "Playwright API" chuyển sang Bước 4 dùng `page.request` (đã login) thay vì fixture `request` ẩn danh.

### Ghi chú
- Đặt route `/:id/details` **trước** route `/:param` chung nếu có để tránh Express 5 nhầm param.
- 31 row/lần chạy: không phân trang, payload < 100KB.

## Bước 4 — UI: số lượng clickable + popup bảng chi tiết

### Yêu cầu cần đạt
- [ ] `updateHistoryTable` (`public/js/configs.js:529-560`): 2 ô Thành công/Thất bại thành nút
      (giữ màu xanh/đỏ), `data-history-id`, `data-status`; bản ghi `has_details=false` → nút disabled + tooltip.
- [ ] Bootstrap 5 modal #1: tiêu đề ngày + giờ bắt đầu/kết thúc; tabs/bộ lọc Thành công-Thất bại;
      bảng STT, Tên trạm (+mã), Trạng thái badge, Thời gian (`poweron_at ?? shutdown_at`), nút 👁.
- [ ] Event delegation (SPA, bảng render lại) — không bind trực tiếp từng dòng.
- [ ] Loading / empty / error state đầy đủ.

### Checklist test (Playwright `tests/fe/shutdown-history.spec.js`)
- [ ] Login `admin/admin123` → vào `/configs` → bảng lịch sử hiện.
- [ ] Ấn số Thành công của record mới nhất có details → modal mở, đếm đúng số dòng.
- [ ] Đổi tab Thất bại → số dòng khớp số đỏ trên bảng.
- [ ] Record cũ (không details) → nút disabled, không mở modal.
- [ ] Reload SPA (`router.js`) rồi ấn lại → vẫn mở (không mất handler).
- [ ] Chụp screenshot modal khi fail để debug (`screenshot: only-on-failure`).

### Kết quả test
- [x] Đã chạy / Ngày: 01/10/2026, Người chạy: AI + chủ dự án giám sát, Kết quả: **PASS**
  - `npx playwright test`: 11 passed, 2 skipped (B5). Modal mở đúng filter được ấn (completed→1 dòng),
    chuyển tab Tất cả→3 dòng, Thất bại/Bỏ qua→1 dòng; bản ghi cũ không có nút bấm;
    reload SPA vẫn mở được (event delegation); API qua `page.request` đúng shape.
  - Lần chạy đầu 2 case fail do kỳ vọng sai của test (tưởng mở modal là thấy hết dòng),
    app đúng — đã sửa test, chạy lại xanh. Seed tự dọn (`seed_left=0, orphan_details=0`).
  - Modal theo convention custom `classList show` sẵn của trang (như `stationsModal`), không dùng `bootstrap.Modal`.

### Ghi chú
- Kiểm tra `partials/configs.html:243-260` còn giữ `colspan=7`; modal đặt cuối file partial.
- Tránh trùng `id` modal với các trang SPA khác (prefix `shutdown`).

## Bước 5 — UI: popup con xem log từng trạm

### Yêu cầu cần đạt
- [ ] Nút 👁 mỗi dòng mở modal con (stack trên modal 1): timeline 4 bước
      Tắt (giờ + OK/lỗi) → Chờ N phút (lấy `shutdown_duration_minutes` của lần chạy) →
      Bật (giờ + OK/lỗi) → Kết luận; `error_message` nguyên văn trong `<pre>`.
- [ ] Trường hợp `failed` pha tắt → ghi rõ "bị bỏ qua pha bật theo thiết kế".
- [ ] Đóng modal con quay lại đúng tab/vị trí modal 1 (không reset filter, không cuộn về đầu).
- [ ] Escape/backdrop chỉ đóng modal con, không đóng cả 2.

### Checklist test (Playwright, nối tiếp spec Bước 4)
- [ ] Mở 1 dòng failed → timeline đủ 4 bước, `<pre>` chứa đúng lỗi DB.
- [ ] Mở 1 dòng success → có đủ 4 mốc giờ, kết luận "đã bật (API OK)".
- [ ] Đóng modal con → modal 1 còn mở, đúng tab cũ.
- [ ] Trạm tắt-lỗi-bỏ-qua-bật → có cảnh báo skipped, không có giờ bật.
- [ ] Mobile viewport 390px: 2 modal không tràn, nút 👁 bấm được.

### Kết quả test
- [x] Đã chạy / Ngày: 01/10/2026, Người chạy: AI + chủ dự án giám sát, Kết quả: **PASS**
  - `npx playwright test`: 13/13 (lần 1 fail 1 case do assert `pre` strict mode — app render đúng lỗi ở cả 2 chỗ,
    đã sửa test dùng `.first`, chạy lại xanh).
  - Mắt ở dòng failed → timeline 4 bước + `<pre>` lỗi nguyên văn; đóng popup con → modal 1 còn mở đúng tab failed (1 dòng);
    dòng skipped có cảnh báo "chưa được bật lại"; mobile 390px mở được cả 2 modal.
  - Popup con đọc từ cache modal 1, không gọi API thêm; nút 👁 nối qua `openStationLog` trong handler delegation sẵn ở B4.

### Ghi chú
- Đây là nơi trả lời câu hỏi "thành công có bật trạm thật không": phase 1 chỉ hiển thị
  trung thực mức API (`error===0` + timestamp). Verify online thật là phase 2 (mục 8).

## Bước 6 — Regression: không vỡ luồng cũ

### Yêu cầu cần đạt
- [ ] Auto-recovery sau shutdown vẫn hoạt động: trạm bật xong vẫn offline ≥30s → job tạo bình thường
      (không bị details mới ảnh hưởng; labels vẫn là nguồn join duy nhất).
- [ ] `GET /api/scheduled-shutdown/status` + `recent_history` cũ không đổi shape (FE cũ không vỡ).
- [ ] Lịch daily 23:23 vẫn chạy 1 lần/ngày (`shouldExecuteNow` không đổi).

### Checklist test
- [ ] So sánh `docker logs` 1 đêm chạy: số job Monitor tạo ≈ kỳ vọng, không có `SKIPPED` bất thường mới.
- [ ] Playwright smoke: login → dashboard → stations → devices → history → configs đều tải 200.
- [ ] `git diff` rà soát: không sửa `autoMonitor.js`, `stationControlService.js` ngoài mức cần thiết (= 0 dòng là tốt nhất).

### Kết quả test
- [x] Đã chạy / Ngày: 01/10/2026, Người chạy: AI + chủ dự án giám sát, Kết quả: **PASS**
  - `git diff --stat` (chỉ đọc, không push): 8 file đổi đúng scope (service, routes, configs.html/js/css,
    package+lock playwright, gitignore); `autoMonitor.js` + `stationControlService.js` = 0 dòng đổi.
  - Scheduler vẫn đồng bộ 5s/lần; queue jobs local = 0 (không kẹt); `/api/scheduled-shutdown/status` OK kèm `details_count`;
    log 60 phút không có `error` mới, không có cảnh báo lệch labels/details.
  - Playwright smoke 5/5 trang 200 trong lần chạy full 13/13.
  - Chưa có 1 đêm chạy lịch thật với code mới (lần execute đầy đủ đầu tiên sẽ là 23:23 tới trên local) —
    theo dõi read-only log sáng hôm sau để đối chiếu `Tổng X | Thành công Y | Thất bại Z` với details.

### Ghi chú
- Chạy regression trên **local docker** (`cgbas-app-dev`), tuyệt đối không test execute thật trên VPS.

## Bước 7 — Retention + docs + nghiệm thu

### Yêu cầu cần đạt
- [ ] Xóa `details` quá 90 ngày khi kết thúc `execute()` (hoặc cron riêng), giữ đồng bộ với log file 30 ngày thì ghi rõ khác biệt trong docs.
- [ ] Cập nhật `docs/function/SCHEDULED_SHUTDOWN.md` (schema details + 2 API mới + ảnh chụp modal).
- [ ] Điền toàn bộ "Kết quả test" các bước trên (ngày, người, pass/fail, link report Playwright).

### Checklist test
- [ ] Seed 1 history giả > 90 ngày → chạy cleanup → details mất, history gốc còn/tùy quyết định (ghi rõ).
- [ ] `npx playwright test` toàn bộ `tests/fe` pass trên Chromium local.
- [ ] Review cuối: mở 1 record mới → modal 1 → modal con → đóng → không lỗi console.

### Kết quả test
- [x] Đã chạy / Ngày: 01/10/2026, Người chạy: AI + chủ dự án giám sát, Kết quả: **PASS**
  - Retention: seed 2 details (1 quá 90 ngày) → prune đúng 1 dòng cũ, giữ dòng mới + history gốc, cascade sạch.
  - `docs/function/SCHEDULED_SHUTDOWN.md` đã cập nhật mục drill-down + query mẫu dùng `details`.
  - Nghiệm thu cuối `npx playwright test`: **13/13 passed**; console không lỗi; seed tự dọn sau suite.

### Ghi chú
- Report Playwright (`playwright-report/`, `test-results/`) cho vào `.gitignore`, chỉ lưu link/file tóm tắt.

## 8. Phase 2 (ngoài scope file này, không làm bây giờ)

- Cột "Trạm online lại": sau `poweronBatch`, job verify sau N phút check `station_dynamic_info.connectStatus`
  rồi update `details.verified_online BOOL` — lúc đó popup mới trả lời được "bật thành công thật không".
- Join `ewelink_api_logs` thô theo deviceid + khung giờ cho tab "API calls" trong popup con.

---

# PHASE 2 — Cột "Trạm online lại": verify độc lập sau khi bật (đã duyệt, đang thực hiện)

> Vấn đề phase 1 để lại: popup chỉ chứng minh "đã gửi lệnh bật, eWeLink báo nhận",
> không đảm bảo trạm có điện thật và online lại.

## Nguyên tắc (đã chốt)
- Không tin API eWeLink, chỉ tin `station_dynamic_info.connectStatus` (chung CGBAS + NTRIP).
- Verify chạy rời sau pha bật N phút bằng **cron quét** (sống qua restart, không `setTimeout` trong `execute()`, không chặn scheduler).
- Không đẻ cơ chế phục hồi mới: trạm verify offline thì monitor sẵn có tự vớt (labels đã xóa).
- Giới hạn đã biết: verify đọc trạng thái cuối đã biết trong DB; delay cấu hình quá ngắn có thể đánh ❌ oan
  (popup vẫn hiển thị trung thực cả 2 sự kiện).

## P2-Bước 1 — Migration `018_verify_online.sql`

### Yêu cầu cần đạt
- [ ] `details`: thêm `verified_online TINYINT NULL` (1 đã online / 0 vẫn offline / NULL chưa tới giờ check),
  `verified_at DATETIME NULL`, `verified_status TINYINT NULL` (connectStatus quan sát được).
- [ ] `scheduled_shutdown_config`: thêm `verify_enabled BOOL DEFAULT 1`, `verify_delay_minutes INT DEFAULT 10`.
- [ ] Idempotent qua bảng `migrations`; không sửa bảng cũ ngoài ADD COLUMN.

### Checklist test
- [ ] Boot log có `Thực thi migration: 018_... (Thành công)`; boot 2 bỏ qua.
- [ ] `DESCRIBE` đủ cột mới; config row có 2 trường mới với default.
- [ ] Playwright: chưa cần.

### Kết quả test
- [x] Đã chạy / Ngày: 01/10/2026, Người chạy: AI + chủ dự án giám sát, Kết quả: **PASS**
  - Boot 1: `Thực thi migration: 018_verify_online.sql (Thành công)`; đủ 3 cột details + 2 cột config, default `(1, 10)`.
  - Boot 2: `018 ... Đã chạy trước đó (Bỏ qua)` — idempotent.
  - Phát hiện khi viết: MySQL 8.0 không hỗ trợ `ADD COLUMN IF NOT EXISTS` — đã bỏ, dùng convention runner sẵn có.
  - Playwright: chưa cần (bước DB thuần).

### Ghi chú (P2-B1)
- Comment SQL để ASCII (quy ước từ Bước 1) để tránh rủi ro encoding.

## P2-Bước 2 — Verifier service (cron 2 phút)

### Yêu cầu cần đạt
- [ ] File mới `src/services/shutdownVerifyService.js` + `runOnce()`: tìm details
  `verified_online IS NULL AND poweron_ok=1 AND poweron_at < NOW() - delay AND history.status='completed'`
  (delay + enabled đọc từ config), đọc `connectStatus` từng trạm, update flag + giờ.
- [ ] Trạm verify offline mà chưa có job trong `station_recovery_jobs` → chỉ log (không insert trùng, monitor tự tạo).
- [ ] Cron 2 phút trong `scheduler.js`; restart giữa chờ → lần cron sau nhặt lại.
- [ ] Không sửa `autoMonitor.js`, `stationControlService.js`, luồng tắt/bật.

### Checklist test
- [ ] Seed details `poweron_at` cũ (online + offline) → `runOnce()` set flag đúng cả 2.
- [ ] Đổi `connectStatus` tay giữa 2 lần chạy → lần sau bắt đúng giá trị mới.
- [ ] `verify_enabled=0` → cron bỏ qua, flag giữ NULL.
- [ ] Restart app giữa chờ → cron sau vẫn hoàn thành (không mất việc).
- [ ] Playwright: chưa cần.

### Kết quả test
- [x] Đã chạy / Ngày: 01/10/2026, Người chạy: AI + chủ dự án giám sát, Kết quả: **PASS (6/6)**
  - Test script trong container: online→1, offline→0, poweron 2 phút trước (delay 10)→giữ NULL,
    đổi giá trị tay→bắt đúng mới, `verify_enabled=0`→skip giữ NULL; dọn sạch, config khôi phục `(1,10)`.
  - Test bắt được 1 bug thật: `require('./logger')` sai đường dẫn → sửa `../utils/logger`, restart boot sạch.
  - Sống qua restart: verifier không giữ state RAM, cron 2 phút đã đăng ký (log boot có `2m (Verify Online)`).
  - Batch verifier theo `batch_size` hiện có để tránh dồn DB khi 31 trạm cùng tới giờ.

### Ghi chú
- Batch verifier theo `batch_size` hiện có để tránh dồn DB khi 31 trạm cùng tới giờ.

## P2-Bước 3 — Cấu hình + API

### Yêu cầu cần đạt
- [ ] Form `/configs` thêm 2 trường (bật/tắt verify, delay 5–30 phút) + validation, qua `PUT /api/scheduled-shutdown/config` sẵn có.
- [ ] API details (`d.*`) tự trả 3 cột mới, không đổi contract; 400/401/404 như cũ.
- [ ] `getStatus`/`getHistory` không vỡ (SELECT * / h.* tự bao cột mới).

### Checklist test
- [ ] Đổi delay → verifier tôn trọng delay mới (seed poweron_at 6 phút trước + delay 10 → còn NULL; delay 5 → được verify).
- [ ] Validation: delay 2 / 99 → 400 với message rõ.
- [ ] Playwright API qua `page.request`: shape gồm 3 trường mới.

### Kết quả test
- [x] Đã chạy / Ngày: 01/10/2026, Người chạy: AI + chủ dự án giám sát, Kết quả: **PASS**
  - `PUT config` hợp lệ → 200; `verify_delay_minutes` 2 và 99 → 400 message rõ; GET config lộ 2 trường mới.
  - Verifier tôn trọng delay: poweron 6 phút trước + delay 10 → giữ NULL; đổi delay 5 → verified 1.
  - Playwright `config API includes verify fields` pass; config DB giữ `(1,10)`, seed dọn sạch.

### Ghi chú (P2-B3)
- Không thêm endpoint mới ở bước này.

## P2-Bước 4 — UI "Online lại" + Playwright

### Yêu cầu cần đạt
- [ ] Bảng modal 1 thêm cột "Online lại": ✅ / ❌ / ⏳ (NULL).
- [ ] Popup con thêm dòng 5: online lúc HH:MM, hoặc vẫn offline tới HH:MM + gợi ý sang trang History.
- [ ] Tab lọc thêm "Chưa online lại" (client-side như các tab sẵn có).
- [ ] EscapeHtml đầy đủ, mobile 390px không tràn.

### Checklist test (Playwright)
- [ ] Seed 3 trạng thái verified (1/0/NULL) → assert đúng 3 icon + tab lọc đúng số dòng.
- [ ] Popup con dòng 5 đúng giờ `verified_at` / đúng gợi ý khi offline.
- [ ] Đóng/mở giữ tab; reload SPA vẫn chạy.
- [ ] Mobile 390px mở được cả 2 modal.

### Kết quả test
- [x] Đã chạy / Ngày: 01/10/2026, Người chạy: AI + chủ dự án giám sát, Kết quả: **PASS**
  - Full suite `npx playwright test`: 16/16 (seed verified 1/0/NULL trong beforeAll).
  - Cột Online lại đủ 3 icon ✅/❌/⏳ (assert theo đếm, không theo thứ tự dòng vì API sort theo tên trạm);
    tab "Chưa online lại" đúng 2 dòng; popup con dòng 5 đúng giờ `verified_at` + gợi ý History khi offline.
  - Text kết luận phase 1 ("sẽ verify ở phase 2") đã thay bằng trạng thái verify thực tế.
  - Static JS/HTML/CSS không cần restart app; seed tự dọn (`seed_left=0`).

### Ghi chú (P2-B4)
- Tab "Chưa online lại" định nghĩa = `verified_online !== 1` (gồm cả NULL chờ verify lẫn 0 offline).

## P2-Bước 5 — Regression + docs + nghiệm thu

### Yêu cầu cần đạt
- [ ] Diff review đúng scope; scheduler 5s/30s/cron-verify cùng chạy không lỗi.
- [ ] Cập nhật `docs/function/SCHEDULED_SHUTDOWN.md` (verify flow + cột mới).
- [ ] Điền toàn bộ "Kết quả test" P2; `npx playwright test` xanh hết.

### Checklist test
- [ ] Log 60 phút không error mới; queue jobs không kẹt.
- [ ] Smoke 5 trang 200.
- [ ] Review cuối không lỗi console.

### Kết quả test
- [x] Đã chạy / Ngày: 01/10/2026, Người chạy: AI + chủ dự án giám sát, Kết quả: **PASS**
  - Diff đúng scope P2 (thêm `018`, `shutdownVerifyService.js`, cron scheduler; không sửa autoMonitor/recovery/ewelink).
  - Log 60 phút không error mới; queue jobs = 0; cron verify đã đăng ký trong log boot.
  - `SCHEDULED_SHUTDOWN.md` cập nhật verify flow + ngữ nghĩa 2 mức "Thành công" vs "Online lại".
  - Nghiệm thu cuối `npx playwright test`: **16/16 passed**, console sạch.

### Ghi chú (P2-B5)
- Lần chạy lịch 23:23 đầu tiên với code phase 2 sẽ sinh verified rows thật đầu tiên — theo dõi read-only sáng hôm sau.

### Ghi chú bổ sung (fix UI toggle 01/10/2026, chưa commit)
- Toggle dùng markup Bootstrap 4 (`custom-control custom-switch`) trong khi trang nạp Bootstrap 5.3.2
  → núm gạt (`::after`) đè lên chữ label. Đã đổi cả 2 toggle (tắt/bật + verify) sang `form-check form-switch`
  chuẩn Bootstrap 5, xóa CSS custom chết. JS giữ nguyên id nên không ảnh hưởng submit/prefill.
- Test Playwright mới `toggle switches do not overlap labels` assert hình học (label.x > switch phải);
  suite 17/17 pass.

## Phụ lục A — Cài Playwright (✅ đã cài & verify 01/10/2026)

```bash
npm i -D @playwright/test            # ✅ 180 packages audited, +3 packages
npx playwright install chromium      # ✅ browser đã tải
npx playwright test                  # ✅ 6 passed, 5 skipped (TODO B4/B5), 8.8s
```

### Kết quả verify cài đặt (01/10/2026, local docker đang chạy)
- `[setup] login as admin` ✅ 2.8s — login `admin/admin123` → redirect `/dashboard` → lưu `tests/fe/.auth.json`.
- Smoke B6 ✅ 5/5 (`/dashboard,/stations,/devices,/history,/configs` đều 200).
- 5 case drill-down (B4/B5) ở trạng thái `test.skip` có lý do — sẽ bật dần khi làm tới Bước 4-5.
- Report/`test-results/` + `.auth.json` đã cho vào `.gitignore`.

```bash
npm i -D @playwright/test
npx playwright install chromium
npx playwright test            # chạy toàn bộ
npx playwright test tests/fe/shutdown-history.spec.js  # chạy 1 file
npx playwright show-report     # xem report
```

- `playwright.config.js`: `testDir: tests/fe`, `baseURL: http://localhost:3001`,
  `webServer` tái sử dụng app đang chạy (không tự start để tránh đụng scheduler 5s),
  `screenshot: only-on-failure`, `trace: retain-on-failure`.
- Login dùng storageState (1 lần) rồi tái sử dụng cho các spec.
- Xem `tests/fe/auth.setup.js` + `tests/fe/shutdown-history.spec.js` (khung todo, viết case khi làm Bước 3-5).
