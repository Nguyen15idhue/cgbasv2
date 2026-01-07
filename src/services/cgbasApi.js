const axios = require('axios');
const crypto = require('crypto');
const { generateCGBASSignature } = require('../utils/crypto');
require('dotenv').config();

const apiClient = axios.create({
    baseURL: process.env.API_BASE_URL
});

async function getAuthenticatedHeaders(method, path) {
    const nonce = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now().toString();
    
    const headers = {
        'Content-Type': 'application/json',
        'X-Access-Key': process.env.AK,
        'X-Nonce': nonce,
        'X-Timestamp': timestamp,
        'X-Sign-Method': 'HmacSHA256'
    };

    // Tạo chữ ký từ logic trong utils
    const sign = generateCGBASSignature(method, path, headers, process.env.SK);
    headers['Sign'] = sign;

    return headers;
}

async function fetchStations(page = 1, size = 9999) {
    const path = '/openapi/stream/stations';
    const headers = await getAuthenticatedHeaders('GET', path);

    const response = await apiClient.get(path, {
        params: { page, size },
        headers: headers
    });

    return response.data;
}

async function fetchDynamicInfo(stationIds) {
    const path = '/openapi/stream/stations/dynamic-info';
    const method = 'POST';
    const headers = await getAuthenticatedHeaders(method, path);

    const response = await apiClient.post(path, { ids: stationIds }, {
        headers: headers
    });

    return response.data;
}

module.exports = { fetchStations, fetchDynamicInfo };