/**
 * API Client - Wrapper around AJAX with specific API endpoints
 */

const API = {
    // Base configuration
    baseURL: '/api',

    /**
     * Authentication APIs
     */
    auth: {
        login: (username, password) => {
            return ajax.post('/auth/login', { username, password });
        },
        
        logout: () => {
            return ajax.post('/auth/logout');
        },

        checkSession: () => {
            return ajax.get('/auth/check');
        }
    },

    /**
     * Station APIs
     */
    stations: {
        list: (params = {}) => {
            return ajax.get('/stations/list', params);
        },

        getStatus: (stationId) => {
            return ajax.get('/stations/status', { stationId });
        },

        getAllStatus: () => {
            return ajax.get('/stations/status');
        },

        recover: (stationId) => {
            return ajax.post('/stations/recover', { stationId });
        },

        updateMapping: (stationId, deviceId, channel) => {
            return ajax.post('/stations/update-mapping', { 
                stationId, 
                deviceId, 
                channel 
            });
        },

        getRecoveryHistory: (params = {}) => {
            return ajax.get('/stations/recovery-history', params);
        },

        getRecoveryStats: () => {
            return ajax.get('/stations/recovery-stats');
        }
    },

    /**
     * eWelink Device APIs
     */
    ewelink: {
        getDevices: () => {
            return ajax.get('/ewelink/devices');
        },

        control: (deviceId, channel, action) => {
            return ajax.post('/ewelink/control', { 
                deviceId, 
                channel, 
                action 
            });
        },

        stationOn: (stationId) => {
            return ajax.post('/ewelink/station-on', { stationId });
        },

        stationOff: (stationId) => {
            return ajax.post('/ewelink/station-off', { stationId });
        },

        getApiStats: () => {
            return ajax.get('/ewelink/api-stats');
        }
    },

    /**
     * Queue APIs
     */
    queue: {
        getActive: () => {
            return ajax.get('/stations/queue/active');
        },

        cancel: (jobId) => {
            return ajax.post('/stations/queue/cancel', { jobId });
        },

        retry: (jobId) => {
            return ajax.post('/stations/queue/retry', { jobId });
        }
    },

    /**
     * Logs APIs
     */
    logs: {
        getApiLogs: (params = {}) => {
            return ajax.get('/logs/api', params);
        },

        getSystemLogs: (params = {}) => {
            return ajax.get('/logs/system', params);
        },

        getRecoveryLogs: (params = {}) => {
            return ajax.get('/logs/recovery', params);
        }
    },

    /**
     * Settings APIs
     */
    settings: {
        get: () => {
            return ajax.get('/settings');
        },

        update: (settings) => {
            return ajax.put('/settings', settings);
        },

        testConnection: (type, config) => {
            return ajax.post('/settings/test-connection', { type, config });
        }
    }
};

// Export API object
window.API = API;
