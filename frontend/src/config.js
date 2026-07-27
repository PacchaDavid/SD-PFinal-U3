const getBaseUrl = () => {
  const host = process.env.REACT_APP_API_HOST || window.location.hostname || 'localhost';
  return `http://${host}:8000`;
};

const getEventMonitorUrl = () => {
  const host = process.env.REACT_APP_EVENT_MONITOR_HOST || window.location.hostname || 'localhost';
  return `http://${host}:8082`;
};

const getCircuitBreakerUrl = () => {
  const host = process.env.REACT_APP_CIRCUIT_BREAKER_HOST || window.location.hostname || 'localhost';
  return `http://${host}:8084`;
};

const config = {
  API_BASE_URL: getBaseUrl(),
  EVENT_MONITOR_URL: getEventMonitorUrl(),
  CIRCUIT_BREAKER_URL: getCircuitBreakerUrl(),
  HEARTBEAT_INTERVAL: 2000,
  RECONNECT_DELAY: 3000,
  POLLING_INTERVAL: 5000,
};

export default config;
