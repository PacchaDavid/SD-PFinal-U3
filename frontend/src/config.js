const getBaseUrl = () => {
  const host = process.env.REACT_APP_API_HOST || window.location.hostname || 'localhost';
  return `http://${host}:8000`;
};

const getEventMonitorUrl = () => {
  const host = process.env.REACT_APP_EVENT_MONITOR_HOST || window.location.hostname || 'localhost';
  return `http://${host}:5000`;
};

const config = {
  API_BASE_URL: getBaseUrl(),
  EVENT_MONITOR_URL: getEventMonitorUrl(),
  HEARTBEAT_INTERVAL: 2000,
  RECONNECT_DELAY: 3000,
  POLLING_INTERVAL: 5000,
};

export default config;
