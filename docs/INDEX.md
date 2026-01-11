# 📑 Documentation Index

Danh mục đầy đủ tất cả tài liệu CGBAS v2.

---

## 🚀 Quick Start

- [README](./README.md) - Tổng quan dự án
- [Installation Guide](./guides/installation.md) - Cài đặt nhanh
- [Configuration Guide](./guides/configuration.md) - Cấu hình hệ thống

---

## 📖 API Documentation

### Authentication & Authorization
- [Authentication API](./api/auth-api.md)
  - POST /api/auth/login
  - POST /api/auth/logout
  - Session management

### Station Management
- [Stations API](./api/stations-api.md)
  - GET /api/stations/list
  - GET /api/stations/status
  - POST /api/stations/recover
  - POST /api/stations/update-mapping
  - GET /api/stations/recovery-history
  - GET /api/stations/recovery-stats

### Device Control
- [eWelink API](./api/ewelink-api.md)
  - GET /api/ewelink/devices
  - POST /api/ewelink/control
  - POST /api/ewelink/station-on
  - POST /api/ewelink/station-off
  - GET /api/ewelink/api-stats

---

## 🏗️ Architecture

### System Design
- [System Overview](./architecture/system-overview.md)
  - High-level architecture
  - Component layers
  - Technology stack
  - Security architecture
  - Scalability considerations

### Core Mechanisms
- [Recovery Mechanism](./architecture/recovery-mechanism.md)
  - Auto-recovery flow
  - Job lifecycle
  - Scenarios (Full/Quick)
  - Monitoring & alerts

- Retry Strategy
  - 2-level retry (Step + Adaptive)
  - Retry intervals: [2, 5, 10, 15, 30, 60] minutes
  - MAX_RETRIES = 6

### Data Flow
- Scheduler (15s cycle)
- Auto Monitor detection
- Recovery execution
- History tracking

---

## 🗄️ Database

### Schema Documentation
- [Database Schema](./database/schema.md)
  - Tables overview
  - Entity relationships
  - Indexes strategy
  - Data retention
  - Backup strategy

### Tables Reference

#### Core Tables
- `users` - System users
- `stations` - RTK station info
- `station_dynamic_info` - Real-time status
- `station_recovery_jobs` - Active job queue
- `station_recovery_history` - Recovery history

#### eWelink Tables
- `ewelink_devices` - Device registry
- `ewelink_status` - Device status
- `ewelink_api_logs` - API call logs

#### System Tables
- `migrations` - Migration tracking

---

## 📚 Guides

### Setup & Configuration
- [Installation Guide](./guides/installation.md)
  - System requirements
  - Prerequisites installation
  - Project installation
  - Database setup
  - First run

- [Configuration Guide](./guides/configuration.md)
  - Environment variables
  - Database configuration
  - Session management
  - API integration (CGBAS PRO, eWelink)
  - Logging configuration
  - Performance tuning

### Deployment
- [Deployment Guide](./guides/deployment.md)
  - Server setup (Ubuntu)
  - Application deployment
  - PM2 configuration
  - Nginx reverse proxy
  - SSL certificate (Let's Encrypt)
  - Firewall configuration
  - Monitoring setup
  - Backup strategy
  - Maintenance procedures
  - Rollback procedures

### Troubleshooting
- [Troubleshooting Guide](./guides/troubleshooting.md)
  - Database issues
  - Application issues
  - API integration issues
  - Recovery issues
  - Performance issues
  - Logging issues
  - Scheduler issues
  - Common error messages

---

## 🔧 Technical Specifications

### Stack Overview
```
Frontend:
- HTML5, CSS3, Vanilla JavaScript

Backend:
- Node.js 18+
- Express.js 5.x
- MySQL 8.0+

Key Libraries:
- axios (HTTP client)
- bcryptjs (Password hashing)
- express-session (Session management)
- node-cron (Scheduling)
- winston (Logging)
- mysql2 (MySQL driver)
```

### System Requirements
```
Minimum:
- CPU: 2 cores
- RAM: 2GB
- Disk: 20GB
- MySQL 8.0+
- Node.js 18+

Recommended:
- CPU: 4 cores
- RAM: 4GB
- Disk: 50GB SSD
- MySQL 8.0+
- Node.js 18 LTS
```

---

## 📊 Features Overview

### Core Features
- ✅ Real-time station monitoring (15s interval)
- ✅ Auto-recovery with adaptive retry
- ✅ Recovery history tracking
- ✅ Device control (eWelink SONOFF)
- ✅ Session-based authentication
- ✅ Comprehensive API logging
- ✅ Daily rotating logs

### Recovery Features
- ✅ Adaptive retry: [2, 5, 10, 15, 30, 60] minutes
- ✅ Step retry: 5 attempts per API call
- ✅ Full & Quick scenarios
- ✅ Success/failure history
- ✅ Alert after 3 failed attempts
- ✅ MAX_RETRIES = 6 limit

### Monitoring Features
- ✅ Dashboard with stats
- ✅ Recovery queue viewer
- ✅ History with filters
- ✅ API usage statistics
- ✅ Weekly trend analysis
- ✅ Top offline stations report

---

## 🎯 Use Cases

### 1. Auto Station Recovery
**Scenario**: Trạm RTK offline do mất điện

**Flow**:
1. Monitor phát hiện connectStatus = 3
2. Tạo recovery job tự động
3. Kích hoạt eWelink device
4. Verify CGBAS status
5. Lưu history

### 2. Manual Device Control
**Scenario**: Điều khiển thiết bị thủ công

**Flow**:
1. Login dashboard
2. Navigate to Devices
3. Toggle channel on/off
4. View status update

### 3. Recovery History Analysis
**Scenario**: Phân tích hiệu quả phục hồi

**Flow**:
1. GET /api/stations/recovery-stats
2. View success rate
3. Identify problematic stations
4. Optimize retry strategy

---

## 📈 Performance Benchmarks

### API Response Times
- Authentication: < 200ms
- Station list: < 500ms
- Recovery history: < 300ms
- Device control: < 1s

### System Capacity
- Stations: 500+
- Concurrent jobs: 20+
- API calls/min: 100+
- Database queries/s: 50+

---

## 🔐 Security

### Authentication
- bcrypt password hashing (10 rounds)
- Session-based auth (24h TTL)
- HttpOnly cookies
- HTTPS in production

### API Security
- CGBAS: HMAC-SHA256 signatures
- eWelink: Bearer token auth
- Rate limiting (Nginx)
- CORS configuration

### Database Security
- Prepared statements (SQL injection prevention)
- Limited user privileges
- SSL connection (production)
- Regular backups

---

## 📝 Change Log

### Version 1.0.0 (Current)
- Initial release
- Auto-recovery mechanism
- Recovery history tracking
- Dashboard UI
- API documentation
- Deployment guides

### Planned Features
- Email/SMS alerts
- Redis session store
- Queue system (Bull)
- Prometheus metrics
- Grafana dashboards
- Docker containerization

---

## 🤝 Contributing

### Development Workflow
1. Fork repository
2. Create feature branch
3. Make changes
4. Write tests
5. Submit pull request

### Code Style
- ESLint configuration
- Prettier formatting
- JSDoc comments
- Meaningful commit messages

---

## 📞 Support

### Documentation
- GitHub: `<repository-url>/docs`
- Issues: `<repository-url>/issues`

### Contact
- Email: support@cgbas.com
- Technical support: tech@cgbas.com

---

## 📚 Related Resources

### External APIs
- [CGBAS PRO API](https://www.cgbas.com/api/docs)
- [eWelink Cloud API](https://coolkit-technologies.github.io/eWeLink-API/)

### Technologies
- [Express.js Docs](https://expressjs.com/)
- [MySQL 8.0 Docs](https://dev.mysql.com/doc/)
- [PM2 Docs](https://pm2.keymetrics.io/)
- [Winston Logger](https://github.com/winstonjs/winston)

---

## 🗂️ Document Structure

```
docs/
├── README.md                          # Documentation overview
├── INDEX.md                           # This file
│
├── api/                               # API Documentation
│   ├── auth-api.md                   # Authentication endpoints
│   ├── stations-api.md               # Station management
│   └── ewelink-api.md                # Device control
│
├── architecture/                      # System Architecture
│   ├── system-overview.md            # High-level design
│   └── recovery-mechanism.md         # Recovery details
│
├── database/                          # Database Documentation
│   └── schema.md                     # Schema & tables
│
└── guides/                            # Setup & Guides
    ├── installation.md               # Installation steps
    ├── configuration.md              # Configuration guide
    ├── deployment.md                 # Production deployment
    └── troubleshooting.md            # Problem solving
```

---

**Last Updated**: January 11, 2026  
**Version**: 1.0.0  
**Maintained by**: CGBAS Development Team
