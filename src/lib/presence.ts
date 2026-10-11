import { useState, useEffect } from 'react';
import { api } from './api';

export interface PresenceInfo {
  isOnline: boolean;
  lastSeen?: string;
}

type PresenceMap = Record<string, PresenceInfo>;
type PresenceListener = (map: PresenceMap) => void;

class PresenceManager {
  private presenceMap: PresenceMap = {};
  private listeners = new Set<PresenceListener>();
  private eventSource: EventSource | null = null;
  private heartbeatInterval: any = null;
  private currentToken: string | null = null;
  private reconnectTimeout: any = null;

  public init(token: string | null) {
    if (this.currentToken === token && this.eventSource) return;
    this.currentToken = token;

    this.disconnect();

    if (!token) {
      this.presenceMap = {};
      this.notify();
      return;
    }

    this.connectStream(token);
    this.startHeartbeat();
  }

  private connectStream(token: string) {
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {}
    }

    try {
      const url = `/api/presence/stream?token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);

      es.addEventListener('presence:init', (event: MessageEvent) => {
        try {
          const snapshot = JSON.parse(event.data);
          this.presenceMap = { ...this.presenceMap, ...snapshot };
          this.notify();
        } catch (err) {
          console.warn('[Presence] Failed to parse presence:init payload:', err);
        }
      });

      es.addEventListener('presence:update', (event: MessageEvent) => {
        try {
          const update = JSON.parse(event.data);
          if (update.userId) {
            this.presenceMap[update.userId] = {
              isOnline: Boolean(update.isOnline),
              lastSeen: update.lastSeen || new Date().toISOString(),
            };
            this.notify();
          }
        } catch (err) {
          console.warn('[Presence] Failed to parse presence:update payload:', err);
        }
      });

      es.onerror = () => {
        try {
          es.close();
        } catch {}
        this.eventSource = null;

        // Schedule reconnect after 3 seconds, and fallback to status polling
        if (!this.reconnectTimeout && this.currentToken) {
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            if (this.currentToken) {
              this.connectStream(this.currentToken);
            }
          }, 3000);
        }
        this.fetchSnapshot();
      };

      this.eventSource = es;
    } catch (err) {
      console.warn('[Presence] EventSource creation failed, fallback to polling:', err);
      this.fetchSnapshot();
    }
  }

  public async fetchSnapshot() {
    try {
      const res = await api.getPresenceSnapshot();
      if (res?.presence) {
        this.presenceMap = { ...this.presenceMap, ...res.presence };
        this.notify();
      }
    } catch {}
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    // Send immediate heartbeat
    api.sendHeartbeat().catch(() => {});

    // Periodic heartbeat every 20 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.currentToken) {
        api.sendHeartbeat().catch(() => {});
      }
    }, 20000);
  }

  public disconnect() {
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {}
      this.eventSource = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  public subscribe(listener: PresenceListener): () => void {
    this.listeners.add(listener);
    listener(this.presenceMap);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener({ ...this.presenceMap });
    }
  }

  public getUserPresence(userId?: string): PresenceInfo {
    if (!userId) return { isOnline: false };
    return this.presenceMap[userId] || { isOnline: false };
  }
}

export const presenceManager = new PresenceManager();

/**
 * React hook to get real-time presence info for a single user
 */
export function useUserPresence(userId?: string): PresenceInfo {
  const [presence, setPresence] = useState<PresenceInfo>(() =>
    presenceManager.getUserPresence(userId)
  );

  useEffect(() => {
    if (!userId) return;

    setPresence(presenceManager.getUserPresence(userId));

    const unsubscribe = presenceManager.subscribe((map) => {
      setPresence(map[userId] || { isOnline: false });
    });

    return unsubscribe;
  }, [userId]);

  return presence;
}

/**
 * React hook to get the entire active presence map
 */
export function usePresenceMap(): PresenceMap {
  const [map, setMap] = useState<PresenceMap>({});

  useEffect(() => {
    const unsubscribe = presenceManager.subscribe((newMap) => {
      setMap(newMap);
    });
    return unsubscribe;
  }, []);

  return map;
}

/**
 * Format last seen ISO timestamp into user-friendly text
 */
export function formatLastSeen(lastSeen?: string): string {
  if (!lastSeen) return 'Offline';
  const timestamp = new Date(lastSeen).getTime();
  if (isNaN(timestamp) || timestamp <= 0) return 'Offline';

  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 45) return 'Active just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Active ${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Active ${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Active yesterday';
  return `Active ${diffDays}d ago`;
}
