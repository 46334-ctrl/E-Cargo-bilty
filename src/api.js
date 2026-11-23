import axios from 'axios';
import { io } from 'socket.io-client';

export const DEFAULT_SERVER_IP = '192.168.18.93';
export const DEFAULT_SERVER_PORT = '5000';

export const getStoredServerIP = () => {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('custom_server_ip');
    if (custom && custom.trim()) return custom.trim();
    if (window.location?.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return window.location.hostname;
    }
  }
  return DEFAULT_SERVER_IP;
};

export const getServerBaseUrl = () => {
  const ipOrHost = getStoredServerIP();
  if (ipOrHost.startsWith('http://') || ipOrHost.startsWith('https://')) {
    return ipOrHost.replace(/\/+$/, '');
  }
  if (ipOrHost.includes(':')) {
    return `http://${ipOrHost}`;
  }
  return `http://${ipOrHost}:${DEFAULT_SERVER_PORT}`;
};

export const getApiUrl = () => `${getServerBaseUrl()}/api`;

/**
 * Rewrites previously stored upload URLs (e.g. from an older LAN IP or relative path)
 * to the currently active backend server base URL so uploaded files remain accessible
 * across Wi-Fi / IP changes.
 */
export const resolveAssetUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
  const uploadIdx = trimmed.indexOf('/uploads/');
  if (uploadIdx !== -1) {
    return `${getServerBaseUrl()}${trimmed.slice(uploadIdx)}`;
  }
  if (trimmed.startsWith('/')) {
    return `${getServerBaseUrl()}${trimmed}`;
  }
  return trimmed;
};

/**
 * Determines whether an Axios/fetch error indicates the backend server could not be reached
 * (network error, timeout, firewall drop, or WebView/CORS block) rather than an API validation error.
 */
export const isBackendUnreachableError = (err) => {
  if (!err || err.response) return false;
  const code = err.code || '';
  const msg = String(err.message || '');
  return (
    code === 'ERR_NETWORK' ||
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    /network|timeout|aborted|failed to fetch|load failed/i.test(msg)
  );
};

/**
 * Probes `${url}/api/health` and returns diagnostic details distinguishing timeouts
 * (typical of firewall/router isolation drops) from immediate refusals/network errors.
 */
export const probeServerConnection = async (customUrl, timeoutMs = 4000) => {
  const baseUrl = customUrl ? customUrl.replace(/\/+$/, '') : getServerBaseUrl();
  const target = `${baseUrl}/api/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(target, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    return {
      ok: res.ok,
      reason: res.ok ? 'ok' : 'http_error',
      status: res.status,
      url: baseUrl
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      ok: false,
      reason: err?.name === 'AbortError' ? 'timeout' : 'unreachable',
      status: 0,
      url: baseUrl
    };
  }
};

export const formatBackendUnreachableMessage = (err, serverUrl, isUrdu) => {
  const isTimeout = err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT' || /timeout/i.test(err?.message || '');
  if (isUrdu) {
    return isTimeout
      ? `سرور (${serverUrl}) سے جواب وقت پر نہیں ملا۔ ونڈوز فائر وال (Port 5000) یا Wi-Fi چیک کریں۔`
      : `سرور (${serverUrl}) سے رابطہ نہیں ہو سکا۔ برائے مہربانی نیچے آئی پی ایڈریس، ایک ہی Wi-Fi اور فائر وال (Port 5000) چیک کریں۔`;
  }
  return isTimeout
    ? `Timed out connecting to ${serverUrl}. Check Windows Firewall (Port 5000) or Wi-Fi isolation.`
    : `Cannot reach backend at ${serverUrl}. Ensure same Wi-Fi, Port 5000 is open in Windows Firewall, or update the Server IP below.`;
};

export const formatProbeStatusMessage = (probe, isUrdu, isReset = false) => {
  const url = probe?.url || getServerBaseUrl();
  if (probe?.ok) {
    if (isReset) {
      return isUrdu ? `ڈیفالٹ آئی پی پر بحال اور منسلک (${url})` : `Reset to default & connected (${url})`;
    }
    return isUrdu ? `رابطہ کامیاب! (${url})` : `Connected to ${url}`;
  }
  if (probe?.reason === 'timeout') {
    return isUrdu
      ? `آئی پی محفوظ، مگر ${url} پر وقت ختم ہو گیا (ونڈوز فائر وال Port 5000 یا راؤٹر چیک کریں)۔`
      : `Saved IP, but ${url} timed out (check Windows Firewall Port 5000 or router AP isolation).`;
  }
  return isUrdu
    ? `${isReset ? 'ڈیفالٹ آئی پی بحال' : 'آئی پی محفوظ'}، مگر ${url} سے جواب نہیں ملا۔ Wi-Fi اور سرور چیک کریں۔`
    : `${isReset ? 'Reset IP' : 'Saved IP'}, but cannot reach ${url}. Check Wi-Fi, Firewall & server.`;
};

export const testServerHealth = async (customUrl, timeoutMs = 4000) => {
  const result = await probeServerConnection(customUrl, timeoutMs);
  return result.ok;
};

export const API_URL = getApiUrl();

// Live dynamic socket instance with transparent Proxy wrapper
let socketInstance = io(getServerBaseUrl(), { autoConnect: true });

export const reconnectSocket = () => {
  const oldCallbacks = socketInstance._callbacks ? { ...socketInstance._callbacks } : {};
  try {
    socketInstance.disconnect();
  } catch (e) {
    // ignore
  }
  socketInstance = io(getServerBaseUrl(), { autoConnect: true });
  Object.keys(oldCallbacks).forEach((evt) => {
    const eventName = evt.startsWith('$') ? evt.slice(1) : evt;
    if (Array.isArray(oldCallbacks[evt])) {
      oldCallbacks[evt].forEach((fn) => {
        socketInstance.on(eventName, fn);
      });
    }
  });
};

export const setStoredServerIP = (newIp) => {
  if (!newIp || !newIp.trim()) {
    localStorage.removeItem('custom_server_ip');
  } else {
    let clean = newIp.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    localStorage.setItem('custom_server_ip', clean);
  }
  api.defaults.baseURL = getApiUrl();
  reconnectSocket();
  return getServerBaseUrl();
};

const socket = new Proxy(
  {},
  {
    get(_target, prop) {
      const val = socketInstance[prop];
      return typeof val === 'function' ? val.bind(socketInstance) : val;
    },
    set(_target, prop, value) {
      socketInstance[prop] = value;
      return true;
    }
  }
);

const api = axios.create({
  baseURL: getApiUrl(),
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error?.response?.status, error?.message, error?.config?.url);
    return Promise.reject(error);
  }
);

// Inject token into requests and ensure baseURL always uses current dynamic server IP
api.interceptors.request.use((config) => {
  config.baseURL = getApiUrl();
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.patch('/auth/me', data),
};

export const logisticsAPI = {
  getPublicOverview: () => api.get('/public/overview'),
  getTrucks: (params) => api.get('/trucks', { params }),
  addTruck: (data) => api.post('/trucks', data),
  updateTruck: (id, data) => api.patch(`/trucks/${id}`, data),
  deleteTruck: (id) => api.delete(`/trucks/${id}`),
  getCargo: (params) => api.get('/cargo', { params }),
  postCargo: (data) => api.post('/cargo', data),
  updateCargo: (id, data) => api.patch(`/cargo/${id}`, data),
  respondToCargo: (id, data) => api.patch(`/cargo/${id}/respond`, data),
  deleteCargo: (id) => api.delete(`/cargo/${id}`),
  getBookings: (params) => api.get('/bookings', { params }),
  createBooking: (data) => api.post('/bookings', data),
  updateBooking: (id, data) => api.patch(`/bookings/${id}`, data),
  completeBooking: (id, data) => api.post(`/bookings/${id}/complete`, data),
  getComplaints: () => api.get('/complaints'),
  postComplaint: (data) => api.post('/complaints', data),
  updateComplaint: (id, data) => api.patch(`/complaints/${id}`, data),
  getNotifications: () => api.get('/notifications'),
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
  getTransporters: () => api.get('/users', { params: { role: 'transporter' } }),
  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data.url;
  },
};

export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getUsers: () => api.get('/users'),
  updateUserStatus: (id, status, reason) => api.patch(`/users/${id}`, { status, reason }),
  getShipments: () => api.get('/admin/shipments'),
  getActivity: () => api.get('/admin/activity'),
  getWhatsAppStatus: () => api.get('/whatsapp/status'),
  sendWhatsAppTest: (data) => api.post('/whatsapp/test', data),
};

export const lostCargoAPI = {
  createReport: (formData) => api.post('/lost-cargo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getReports: (params) => api.get('/lost-cargo', { params }),
  getReportById: (id) => api.get(`/lost-cargo/${id}`),
  updateReport: (id, data) => api.patch(`/lost-cargo/${id}`, data),
};

export { socket };
export default api;
