const express = require('express');
const router = express.Router();
const db = require('../config/database');
const stationRepo = require('../repository/stationRepo');

// NTRIP Service URL (Go service)
const NTRIP_SERVICE_URL = process.env.NTRIP_SERVICE_URL || 'http://ntrip-dev:3101';

// API: Health check từ Go NTRIP service
router.get('/health', async (req, res) => {
    try {
        const response = await fetch(`${NTRIP_SERVICE_URL}/health`);
        const data = await response.json();
        res.json({ success: true, ntrip_service: data });
    } catch (err) {
        res.status(503).json({ 
            success: false, 
            message: 'NTRIP service không khả dụng',
            error: err.message 
        });
    }
});

// API: Danh sách trạm NTRIP
router.get('/stations', async (req, res) => {
    try {
        const stations = await stationRepo.getNtripStations();
        
        // Lấy thêm NTRIP config cho mỗi trạm
        const stationsWithConfig = await Promise.all(stations.map(async (station) => {
            const config = await stationRepo.getNtripConfig(station.id);
            return {
                ...station,
                ntrip_config: config
            };
        }));

        res.json({ 
            success: true, 
            total: stationsWithConfig.length,
            data: stationsWithConfig 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// API: Trạng thái realtime của trạm NTRIP
router.get('/status/:stationId', async (req, res) => {
    try {
        const { stationId } = req.params;
        
        // Kiểm tra trạm có phải NTRIP không
        const station = await stationRepo.getNtripConfig(stationId);
        if (!station) {
            return res.status(404).json({ 
                success: false, 
                message: 'Trạm không tồn tại hoặc không phải trạm NTRIP' 
            });
        }

        // Lấy trạng thái từ Go service
        try {
            const response = await fetch(`${NTRIP_SERVICE_URL}/status`);
            const statuses = await response.json();
            const stationStatus = statuses.find(s => s.stationId === stationId);
            
            res.json({ 
                success: true, 
                data: {
                    station_id: stationId,
                    mountpoint: station.mountpoint,
                    ntrip_url: station.ntrip_url,
                    status: stationStatus || { stationId, status: 0 }
                }
            });
        } catch (err) {
            // Nếu Go service không khả dụng, lấy từ DB
            const [dynamicInfo] = await db.query(
                'SELECT * FROM station_dynamic_info WHERE stationId = ?',
                [stationId]
            );
            
            res.json({ 
                success: true, 
                data: {
                    station_id: stationId,
                    mountpoint: station.mountpoint,
                    ntrip_url: station.ntrip_url,
                    status: dynamicInfo[0] || { connectStatus: 0 }
                }
            });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// API: Lấy NTRIP logs của trạm
router.get('/logs/:stationId', async (req, res) => {
    try {
        const { stationId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        
        const [logs] = await db.query(
            'SELECT * FROM ntrip_logs WHERE station_id = ? ORDER BY created_at DESC LIMIT ?',
            [stationId, limit]
        );
        
        res.json({ 
            success: true, 
            total: logs.length,
            data: logs 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// API: Lấy tất cả NTRIP logs
router.get('/logs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const stationId = req.query.stationId || '';
        
        let query = 'SELECT * FROM ntrip_logs';
        let params = [];
        
        if (stationId) {
            query += ' WHERE station_id = ?';
            params.push(stationId);
        }
        
        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(limit);
        
        const [logs] = await db.query(query, params);
        
        res.json({ 
            success: true, 
            total: logs.length,
            data: logs 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
