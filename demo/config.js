import eWeLink from 'ewelink-api-next'

// https://dev.ewelink.cc/
// Login
// Apply to become a developer
// Create an application

const _config = {
  appId: '0tK1GmwzjeIuCxlrKganspQe7Zyu67zd', // App ID, which needs to be configured in the eWeLink open platform
  appSecret: 'Ih3ttfadbrNKFCRuASuUGvRwfIBSnlSz', // App Secret, which needs to be configured in the eWeLink open platform
  region: 'eu', //Feel free, it will be automatically updated after login
  requestRecord: true, // Request record, default is false
  // logObj: console, // Log object, default is console
}

if (!_config.appId || !_config.appSecret) {
  throw new Error('Please configure appId and appSecret')
}

export const client = new eWeLink.WebAPI(_config)
export const wsClient = new eWeLink.Ws(_config);

export const redirectUrl = 'http://127.0.0.1:3001/redirectUrl' // Redirect URL, which needs to be configured in the eWeLeLink open platform

// API Keys
export const ACCESS_KEY = "FvQIhtUF9NVIpTBw"; // Thay bằng Access Key của bạn
export const SECRET_KEY = "FOwKrjoTRTqPuXrq"; // Thay bằng Secret Key của bạn

export const API_BASE_URL = "http://rtk.taikhoandodac.vn:8090";
// Generate random strings
export const randomString = (length) => {
  return [...Array(length)].map(_=>(Math.random()*36|0).toString(36)).join('');
}

