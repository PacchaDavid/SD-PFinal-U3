import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { connect, disconnect, on, isConnected, subscribe, SOCKET_EVENTS } from '../services/socket';

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  const [lastMetrics, setLastMetrics] = useState(null);
  const [lastNodeStatus, setLastNodeStatus] = useState(null);
  const [lastCircuitChange, setLastCircuitChange] = useState(null);
  const [lastReplication, setLastReplication] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const unsubscribers = useRef([]);

  useEffect(() => {
    // Connect and set up listeners
    const socket = connect();
    setConnected(isConnected());

    const unsubs = [
      on(SOCKET_EVENTS.CONNECT, () => {
        setConnected(true);
        setConnectionError(null);
      }),
      on(SOCKET_EVENTS.DISCONNECT, () => {
        setConnected(false);
      }),
      on(SOCKET_EVENTS.CONNECT_ERROR, (data) => {
        setConnected(false);
        setConnectionError(data.error || 'Error de conexión');
      }),
      on(SOCKET_EVENTS.EVENT, (data) => {
        setLastEvent({ ...data, _receivedAt: Date.now() });
      }),
      on(SOCKET_EVENTS.HEARTBEAT, (data) => {
        setLastHeartbeat({ ...data, _receivedAt: Date.now() });
      }),
      on(SOCKET_EVENTS.METRICS, (data) => {
        setLastMetrics({ ...data, _receivedAt: Date.now() });
      }),
      on(SOCKET_EVENTS.NODE_STATUS, (data) => {
        setLastNodeStatus({ ...data, _receivedAt: Date.now() });
      }),
      on(SOCKET_EVENTS.CIRCUIT_CHANGE, (data) => {
        setLastCircuitChange({ ...data, _receivedAt: Date.now() });
      }),
      on(SOCKET_EVENTS.REPLICATION, (data) => {
        setLastReplication({ ...data, _receivedAt: Date.now() });
      }),
    ];

    unsubscribers.current = unsubs;

    return () => {
      unsubs.forEach((unsub) => unsub());
      disconnect();
    };
  }, []);

  const subscribeToRoom = useCallback((room) => {
    subscribe(room);
  }, []);

  const value = useMemo(() => ({
    connected,
    connectionError,
    lastEvent,
    lastHeartbeat,
    lastMetrics,
    lastNodeStatus,
    lastCircuitChange,
    lastReplication,
    subscribeToRoom,
  }), [
    connected,
    connectionError,
    lastEvent,
    lastHeartbeat,
    lastMetrics,
    lastNodeStatus,
    lastCircuitChange,
    lastReplication,
    subscribeToRoom,
  ]);

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket debe usarse dentro de WebSocketProvider');
  }
  return context;
}

export { SOCKET_EVENTS } from '../services/socket';
export default WebSocketContext;
