import { io } from 'socket.io-client';
import config from '../config';

let socket = null;
let listeners = {};
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 20;

const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  EVENT: 'event',
  HEARTBEAT: 'heartbeat',
  METRICS: 'metrics',
  NODE_STATUS: 'node_status',
  CIRCUIT_CHANGE: 'circuit_change',
  REPLICATION: 'replication',
  SYSTEM_STATUS: 'system_status',
  PONG: 'pong',
};

function createSocket() {
  if (socket?.connected) return socket;

  const serverUrl = config.EVENT_MONITOR_URL; // http://host:5000

  socket = io(serverUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
    autoConnect: true,
    forceNew: true,
  });

  socket.on(SOCKET_EVENTS.CONNECT, () => {
    connectionAttempts = 0;
    const sid = socket.id;
    // Auto-subscribe to admin room for all events
    socket.emit('subscribe', { room: 'admin' });
    fireListeners(SOCKET_EVENTS.CONNECT, { sid, connected: true });
  });

  socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
    fireListeners(SOCKET_EVENTS.DISCONNECT, { reason, connected: false });
  });

  socket.on(SOCKET_EVENTS.CONNECT_ERROR, (error) => {
    connectionAttempts++;
    fireListeners(SOCKET_EVENTS.CONNECT_ERROR, {
      error: error.message || 'Connection error',
      attempts: connectionAttempts,
    });
  });

  // Event router: distribuye eventos del Event Monitor a listeners registrados
  socket.on(SOCKET_EVENTS.EVENT, (data) => {
    fireListeners(SOCKET_EVENTS.EVENT, data);
  });

  socket.on(SOCKET_EVENTS.HEARTBEAT, (data) => {
    fireListeners(SOCKET_EVENTS.HEARTBEAT, data);
  });

  socket.on(SOCKET_EVENTS.METRICS, (data) => {
    fireListeners(SOCKET_EVENTS.METRICS, data);
  });

  socket.on(SOCKET_EVENTS.NODE_STATUS, (data) => {
    fireListeners(SOCKET_EVENTS.NODE_STATUS, data);
  });

  socket.on(SOCKET_EVENTS.CIRCUIT_CHANGE, (data) => {
    fireListeners(SOCKET_EVENTS.CIRCUIT_CHANGE, data);
  });

  socket.on(SOCKET_EVENTS.REPLICATION, (data) => {
    fireListeners(SOCKET_EVENTS.REPLICATION, data);
  });

  socket.on(SOCKET_EVENTS.SYSTEM_STATUS, (data) => {
    fireListeners(SOCKET_EVENTS.SYSTEM_STATUS, data);
  });

  return socket;
}

function fireListeners(event, data) {
  if (listeners[event]) {
    listeners[event].forEach((fn) => {
      try { fn(data); } catch (e) { console.warn('Socket listener error:', event, e); }
    });
  }
}

// API pública ----------------------------------------------------------------

export function connect() {
  if (!socket) return createSocket();
  if (!socket.connected) socket.connect();
  return socket;
}

export function disconnect() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  listeners = {};
}

export function getSocket() {
  return socket;
}

export function isConnected() {
  return socket?.connected || false;
}

export function on(event, callback) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(callback);
  // Return unsubscribe function
  return () => {
    if (listeners[event]) {
      listeners[event] = listeners[event].filter((fn) => fn !== callback);
    }
  };
}

export function off(event, callback) {
  if (listeners[event]) {
    listeners[event] = listeners[event].filter((fn) => fn !== callback);
  }
}

export function subscribe(room) {
  if (socket?.connected) {
    socket.emit('subscribe', { room });
  }
}

export function unsubscribe(room) {
  if (socket?.connected) {
    socket.emit('unsubscribe', { room });
  }
}

export function ping() {
  if (socket?.connected) {
    socket.emit('ping');
  }
}

export { SOCKET_EVENTS };
