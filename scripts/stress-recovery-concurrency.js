const db = require('../src/config/database');
const DISPATCH_LOCK_NAME = 'recovery_dispatch_lock';

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seedJobs(prefix, totalJobs) {
    for (let i = 1; i <= totalJobs; i++) {
        const stationId = `${prefix}${i}`;
        const deviceId = `stress-device-${i}`;
        await db.execute(
            'INSERT INTO station_recovery_jobs (station_id, device_id, status, retry_index, next_run_time) VALUES (?, ?, "PENDING", 0, NOW())',
            [stationId, deviceId]
        );
    }
}

async function claimLoop({ prefix, maxConcurrent, stopAt }) {
    let claimed = 0;
    let maxSeen = 0;
    let violations = 0;

    while (Date.now() < stopAt) {
        const [lockRows] = await db.execute('SELECT GET_LOCK(?, 0) as lock_ok', [DISPATCH_LOCK_NAME]);
        const lockOk = Number(lockRows?.[0]?.lock_ok || 0) === 1;

        if (!lockOk) {
            await sleep(randInt(5, 20));
            continue;
        }

        try {
        const [activeRows] = await db.execute(
            'SELECT COUNT(*) as total FROM station_recovery_jobs WHERE station_id LIKE ? AND status IN ("RUNNING", "CHECKING")',
            [`${prefix}%`]
        );

        const runningCount = activeRows[0].total || 0;
        maxSeen = Math.max(maxSeen, runningCount);
        if (runningCount > maxConcurrent) {
            violations += 1;
        }

        const availableSlots = Math.max(0, maxConcurrent - runningCount);

        if (availableSlots <= 0) {
            await sleep(randInt(10, 30));
            continue;
        }

        const [jobsToRun] = await db.query(
            `SELECT id FROM station_recovery_jobs
             WHERE station_id LIKE ? AND status = "PENDING" AND next_run_time <= NOW()
             ORDER BY next_run_time ASC
             LIMIT ${availableSlots}`,
            [`${prefix}%`]
        );

        if (jobsToRun.length === 0) {
            await sleep(randInt(10, 30));
            continue;
        }

        for (const job of jobsToRun) {
            const [claimResult] = await db.execute(
                'UPDATE station_recovery_jobs SET status = "RUNNING" WHERE id = ? AND status = "PENDING"',
                [job.id]
            );

            if (claimResult.affectedRows === 0) {
                continue;
            }

            claimed += 1;

            // Simulate runAutoRecovery lifecycle without calling external APIs.
            setTimeout(async () => {
                try {
                    await db.execute(
                        'UPDATE station_recovery_jobs SET status = "CHECKING" WHERE id = ? AND status = "RUNNING"',
                        [job.id]
                    );
                    await sleep(randInt(80, 200));
                    await db.execute(
                        'UPDATE station_recovery_jobs SET status = "SUCCESS" WHERE id = ? AND status IN ("RUNNING", "CHECKING")',
                        [job.id]
                    );
                } catch (error) {
                    await db.execute(
                        'UPDATE station_recovery_jobs SET status = "FAILED" WHERE id = ? AND status IN ("RUNNING", "CHECKING")',
                        [job.id]
                    );
                }
            }, randInt(80, 200));
        }

        const [activeAfterClaimRows] = await db.execute(
            'SELECT COUNT(*) as total FROM station_recovery_jobs WHERE station_id LIKE ? AND status IN ("RUNNING", "CHECKING")',
            [`${prefix}%`]
        );
        const activeAfterClaim = activeAfterClaimRows[0].total || 0;
        maxSeen = Math.max(maxSeen, activeAfterClaim);
        if (activeAfterClaim > maxConcurrent) {
            violations += 1;
        }

        } finally {
            await db.execute('SELECT RELEASE_LOCK(?)', [DISPATCH_LOCK_NAME]);
        }

        await sleep(randInt(5, 20));
    }

    return { claimed, maxSeen, violations };
}

async function countStatus(prefix) {
    const [rows] = await db.execute(
        'SELECT status, COUNT(*) as total FROM station_recovery_jobs WHERE station_id LIKE ? GROUP BY status ORDER BY status',
        [`${prefix}%`]
    );
    return rows;
}

async function waitUntilSettled(prefix, timeoutMs) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
        const [rows] = await db.execute(
            'SELECT COUNT(*) as pending_or_active FROM station_recovery_jobs WHERE station_id LIKE ? AND status IN ("PENDING", "RUNNING", "CHECKING")',
            [`${prefix}%`]
        );
        if ((rows[0].pending_or_active || 0) === 0) {
            return true;
        }
        await sleep(100);
    }
    return false;
}

async function cleanup(prefix) {
    await db.execute('DELETE FROM station_recovery_jobs WHERE station_id LIKE ?', [`${prefix}%`]);
}

async function main() {
    const maxConcurrent = Number(process.argv[2] || 10);
    const totalJobs = Number(process.argv[3] || 300);
    const workers = Number(process.argv[4] || 1);
    const durationSec = Number(process.argv[5] || 20);
    const keepData = process.argv.includes('--keep');

    const prefix = `stress-${Date.now()}-`;
    const stopAt = Date.now() + durationSec * 1000;

    if (!Number.isFinite(maxConcurrent) || maxConcurrent <= 0) {
        throw new Error('maxConcurrent must be > 0');
    }

    console.log('=== Recovery Concurrency Stress Test ===');
    console.log(`maxConcurrent=${maxConcurrent}`);
    console.log(`totalJobs=${totalJobs}`);
    console.log(`dispatchWorkers=${workers}`);
    console.log(`durationSec=${durationSec}`);
    console.log(`prefix=${prefix}`);

    if (workers > 1) {
        console.log('NOTE: workers > 1 simulates multi-instance dispatch race, stricter than normal production scheduler.');
    }

    await cleanup('stress-');
    await seedJobs(prefix, totalJobs);

    const workerPromises = [];
    for (let i = 0; i < workers; i++) {
        workerPromises.push(claimLoop({ prefix, maxConcurrent, stopAt }));
    }

    const workerResults = await Promise.all(workerPromises);
    const totalClaimed = workerResults.reduce((sum, x) => sum + x.claimed, 0);
    const maxSeen = workerResults.reduce((max, x) => Math.max(max, x.maxSeen), 0);
    const violations = workerResults.reduce((sum, x) => sum + x.violations, 0);

    await waitUntilSettled(prefix, 15000);
    const status = await countStatus(prefix);

    console.log('--- Result ---');
    console.log(`claimed=${totalClaimed}`);
    console.log(`maxActiveSeen=${maxSeen}`);
    console.log(`violations=${violations}`);
    console.log('statusBreakdown=', status);

    if (!keepData) {
        await cleanup(prefix);
    }

    if (violations > 0) {
        process.exitCode = 1;
        console.log('FAILED: concurrency cap violated');
    } else {
        console.log('PASSED: no point exceeded maxConcurrent');
    }

    await db.end();
}

main().catch(async (error) => {
    console.error('Stress test failed:', error.message);
    try {
        await db.end();
    } catch (e) {
        // no-op
    }
    process.exit(1);
});
