# 🔄 Recovery Mechanism

Cơ chế phục hồi tự động trạm RTK khi offline.

---

## Overview

Hệ thống tự động phát hiện trạm offline và thực hiện kịch bản điều khiển thiết bị eWelink để khởi động lại trạm mà không cần can thiệp thủ công.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              CGBAS PRO (Trạng thái trạm)                    │
│              connectStatus: 0,1,2,3                         │
└───────────────────────────┬─────────────────────────────────┘
                            │ Poll every 15s
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Auto Monitor                            │
│  1. Quét trạm: connectStatus = 3 (Offline)                 │
│  2. Kiểm tra: có ewelink_device_id?                        │
│  3. Kiểm tra: chưa có job trong queue?                     │
│  4. → Tạo job mới (PENDING)                                │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 Station Recovery Jobs                       │
│  - station_id, device_id                                    │
│  - status: PENDING                                          │
│  - retry_index: 0                                           │
│  - next_run_time: NOW() + 2 minutes                        │
└───────────────────────────┬─────────────────────────────────┘
                            │ Scheduler picks job
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Recovery Execution Engine                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 1. Check eWelink device online                      │  │
│  │    → Offline? Reschedule +2min                      │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 2. Check Kênh 1 (Nguồn) status                      │  │
│  │    → OFF? Full scenario                             │  │
│  │    → ON? Quick scenario                             │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 3. Execute scenario (with 5 retries per step)       │  │
│  │    FULL:                                            │  │
│  │    - Bật Kênh 1 (Nguồn)                            │  │
│  │    - Sleep 10s                                      │  │
│  │    - Bật Kênh 2 (Nút)                              │  │
│  │    - Sleep 5s                                       │  │
│  │    - Tắt Kênh 2 (Nhả)                              │  │
│  │                                                     │  │
│  │    QUICK:                                           │  │
│  │    - Bật Kênh 2                                    │  │
│  │    - Sleep 5s                                       │  │
│  │    - Tắt Kênh 2                                    │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 4. Wait 2 minutes for station boot                  │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 5. Verify CGBAS connectStatus                       │  │
│  │    → Online? SUCCESS                                │  │
│  │    → Offline? Reschedule                            │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌──────────────────────┐      ┌───────────────────────┐
│    SUCCESS           │      │   FAILED/RESCHEDULE   │
│                      │      │                       │
│ - Save to history    │      │ - retry_index++       │
│ - Delete job         │      │ - next_run_time =     │
│ - Status: SUCCESS    │      │   NOW() + interval    │
└──────────────────────┘      │ - Intervals:          │
                              │   [2,5,10,15,30,60]   │
                              │                       │
                              │ After 6 retries:      │
                              │ - Save to history     │
                              │ - Delete job          │
                              │ - Status: FAILED      │
                              └───────────────────────┘
```

---

## Components

### 1. Auto Monitor (`autoMonitor.js`)

**Nhiệm vụ**: Phát hiện trạm offline và tạo job tự động.

```javascript
async function checkAndTriggerRecovery() {
    // Quét trạm offline chưa có job
    const [offlineStations] = await db.query(`
        SELECT s.id, s.ewelink_device_id 
        FROM stations s
        JOIN station_dynamic_info d ON s.id = d.stationId
        LEFT JOIN station_recovery_jobs j ON s.id = j.station_id
        WHERE d.connectStatus = 3
        AND s.ewelink_device_id IS NOT NULL
        AND j.id IS NULL
    `);

    // Tạo job cho mỗi trạm
    for (const st of offlineStations) {
        await db.execute(
            'INSERT INTO station_recovery_jobs ...',
            [st.id, st.ewelink_device_id]
        );
    }

    // Lấy job đến hạn và chạy
    const [jobsToRun] = await db.query(`
        SELECT * FROM station_recovery_jobs 
        WHERE status = 'PENDING' AND next_run_time <= NOW()
    `);

    for (const job of jobsToRun) {
        runAutoRecovery(job);
    }
}
```

**Chạy**: Mỗi 15 giây qua scheduler.

---

### 2. Recovery Engine (`stationControlService.js`)

**Nhiệm vụ**: Thực thi kịch bản phục hồi.

#### Step 1: Check Device Online

```javascript
const deviceRes = await ewelinkService.getAllThings();
const device = deviceRes.data.thingList.find(t => t.itemData.deviceid === device_id);

if (!device || !device.itemData.online) {
    // Thiết bị offline → Reschedule
    return await rescheduleJob(station_id, retry_index, "Thiết bị eWelink Ngoại tuyến", device_id);
}
```

#### Step 2: Determine Scenario

```javascript
const switches = device.itemData.params.switches || [];
const ch1Status = switches.find(s => s.outlet === 0)?.switch;

if (ch1Status === 'off') {
    // FULL SCENARIO: Nguồn đang tắt
    await turnOnPowerAndButton();
} else {
    // QUICK SCENARIO: Nguồn đã bật, chỉ kích nút
    await pressButton();
}
```

#### Step 3: Execute with Retry

```javascript
const ok1 = await retryAction(
    () => ewelinkService.toggleChannel(device_id, 0, 'on'),
    "Bật Kênh 1"
);

if (!ok1) {
    // API fail sau 5 lần → Reschedule
    return await rescheduleJob(station_id, retry_index, "Lỗi API khi Bật Kênh 1", device_id);
}
```

#### Step 4: Verify Result

```javascript
await sleep(120000); // Đợi 2 phút

const dynamicInfo = await cgbasApi.fetchDynamicInfo([station_id]);
const stationStatus = dynamicInfo.data.find(s => s.stationId === station_id);

if (stationStatus && stationStatus.connectStatus === 1) {
    // SUCCESS
    await saveToHistory(station_id, device_id, 'SUCCESS', retry_index + 1, null);
    await db.execute('DELETE FROM station_recovery_jobs WHERE station_id = ?', [station_id]);
} else {
    // FAILED
    return await rescheduleJob(station_id, retry_index, "Trạm không có tín hiệu sau điều khiển", device_id);
}
```

---

## Retry Strategy

### 2-Level Retry

#### **Level 1: Step Retry (Immediate)**

Mỗi lệnh API eWelink được retry ngay lập tức:

```javascript
// helper.js
async function retryAction(actionFn, label, maxRetries = 5) {
    for (let i = 1; i <= maxRetries; i++) {
        try {
            const result = await actionFn();
            if (result && result.error === 0) return true;
        } catch (error) {
            if (i === maxRetries) return false;
            await sleep(2000); // 2 giây
        }
    }
}
```

**Timeline**:
- Lần 1: 0s
- Lần 2: 2s
- Lần 3: 4s
- Lần 4: 6s
- Lần 5: 8s
- **Total**: 10 giây

#### **Level 2: Adaptive Retry (Scheduled)**

Khi cả job thất bại, reschedule với thời gian tăng dần:

```javascript
const RETRY_INTERVALS = [2, 5, 10, 15, 30, 60]; // Phút
const MAX_RETRIES = 6;

async function rescheduleJob(station_id, retry_index, reason, device_id) {
    if (retry_index >= MAX_RETRIES) {
        // Đạt giới hạn → FAILED
        await saveToHistory(station_id, device_id, 'FAILED', retry_index, reason);
        await db.execute('DELETE FROM station_recovery_jobs WHERE station_id = ?', [station_id]);
        return;
    }
    
    const waitMin = RETRY_INTERVALS[retry_index] || 60;
    const nextRun = new Date(Date.now() + waitMin * 60000);
    
    await db.execute(
        'UPDATE station_recovery_jobs SET status = "PENDING", retry_index = ?, next_run_time = ?',
        [retry_index + 1, nextRun, station_id]
    );
}
```

**Timeline**:
- Lần 1: +2 phút
- Lần 2: +5 phút
- Lần 3: +10 phút ⚠️ (Alert)
- Lần 4: +15 phút
- Lần 5: +30 phút
- Lần 6: +60 phút
- **Sau lần 6**: FAILED

**Total**: ~122 phút (~2 giờ)

---

## Scenarios

### Full Scenario (Nguồn OFF)

```
Timeline:
0s      → Bật Kênh 1 (Nguồn)        [5 retries, max 10s]
10s     → Sleep
20s     → Bật Kênh 2 (Nút)          [5 retries, max 10s]
25s     → Sleep (giữ nút)
30s     → Tắt Kênh 2 (Nhả nút)      [5 retries, max 10s]
40s     → Update status CHECKING
40s     → Sleep 2 minutes
160s    → Verify CGBAS status
```

**Total time**: ~2 phút 40 giây

### Quick Scenario (Nguồn ON)

```
Timeline:
0s      → Bật Kênh 2 (Nút)          [5 retries, max 10s]
5s      → Sleep (giữ nút)
10s     → Tắt Kênh 2 (Nhả nút)      [5 retries, max 10s]
20s     → Update status CHECKING
20s     → Sleep 2 minutes
140s    → Verify CGBAS status
```

**Total time**: ~2 phút 20 giây

---

## Job Status Lifecycle

```
PENDING
   ↓ (next_run_time reached)
RUNNING
   ↓ (executing scenario)
CHECKING
   ↓ (waiting 2min verification)
   ├─→ SUCCESS → Save history → Delete job
   └─→ FAILED  → Reschedule → Back to PENDING
                 ↓ (after 6 retries)
              FAILED → Save history → Delete job
```

---

## History Tracking

### Success Record

```json
{
  "station_id": "STA001",
  "device_id": "1000abc123",
  "status": "SUCCESS",
  "retry_count": 2,
  "total_duration_minutes": 12,
  "failure_reason": null,
  "started_at": "2026-01-11 08:00:00",
  "completed_at": "2026-01-11 08:12:00"
}
```

### Failure Record

```json
{
  "station_id": "STA001",
  "device_id": "1000abc123",
  "status": "FAILED",
  "retry_count": 6,
  "total_duration_minutes": 122,
  "failure_reason": "Trạm không có tín hiệu sau điều khiển",
  "started_at": "2026-01-11 08:00:00",
  "completed_at": "2026-01-11 10:02:00"
}
```

---

## Monitoring & Alerts

### Alert Triggers

#### **Level 1: Info** (Lần thử 1-2)
```javascript
logger.info(`[Job ${station_id}] Tạm dừng do: ${reason}. Thử lại sau ${waitMin} phút.`);
```

#### **Level 2: Warning** (Lần thử 3+)
```javascript
logger.error(`[Job ${station_id}] 🔔 CẢNH BÁO: Đã thử ${retry_index + 1} lần không thành công!`);
logger.error(`[Job ${station_id}] Trạm có vấn đề nghiêm trọng. Cần kiểm tra thủ công.`);
// TODO: Gửi Email/SMS/Telegram
```

#### **Level 3: Critical** (Đạt MAX_RETRIES)
```javascript
logger.error(`[Job ${station_id}] 🚨 ĐÃ ĐẠT GIỚI HẠN ${MAX_RETRIES} LẦN THỬ. Đánh dấu FAILED.`);
// TODO: Gửi alert khẩn cấp
```

---

## Performance Considerations

### Database Queries

**Tối ưu**:
```sql
-- Index trên các cột query thường xuyên
CREATE INDEX idx_connect_status ON station_dynamic_info(connectStatus);
CREATE INDEX idx_next_run ON station_recovery_jobs(next_run_time);
CREATE INDEX idx_status ON station_recovery_jobs(status);
```

### Concurrency

**Current**: Sequential job execution (safe but slower)

**Recommendation**: 
- Parallel execution với Worker Pool
- Queue system (Bull + Redis)
- Max 5 jobs đồng thời

---

## Failure Modes & Handling

| Failure Mode | Detection | Action |
|--------------|-----------|--------|
| eWelink device offline | Device check fail | Reschedule +2min |
| API timeout | retryAction fail | Reschedule |
| CGBAS API down | fetchDynamicInfo fail | Log error, skip verification |
| Station no signal | connectStatus still 3 | Reschedule |
| Database connection lost | Try-catch | Log error, skip cycle |

---

## Testing Scenarios

### Manual Testing

```bash
# 1. Tạo job thủ công
curl -X POST http://localhost:3000/api/stations/recover \
  -H "Content-Type: application/json" \
  -d '{"stationId":"TEST001","deviceId":"1000abc123"}' \
  -b cookies.txt

# 2. Xem job queue
curl http://localhost:3000/api/queue/jobs -b cookies.txt

# 3. Xem lịch sử
curl http://localhost:3000/api/stations/recovery-history?limit=10 -b cookies.txt
```

---

**Related:**
- [Retry Strategy](./retry-strategy.md)
- [eWelink API](../api/ewelink-api.md)
- [Stations API](../api/stations-api.md)
