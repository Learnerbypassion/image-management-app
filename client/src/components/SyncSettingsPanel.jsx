import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  HiOutlineArrowPath,
  HiOutlineClock,
  HiOutlineCog6Tooth,
  HiOutlineExclamationTriangle,
  HiOutlineCheckCircle,
  HiOutlineSignal,
} from 'react-icons/hi2';

const INTERVAL_LABELS = {
  '5m': 'Every 5 minutes',
  '15m': 'Every 15 minutes',
  '30m': 'Every 30 minutes',
  '1h': 'Every 1 hour',
  'manual': 'Manual only',
};

const SyncSettingsPanel = ({ roomId, onSyncComplete, onReconnectDrive }) => {
  const [syncState, setSyncState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState('5m');
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchSyncStatus = useCallback(async () => {
    try {
      const { data } = await api.get(`/drive/rooms/${roomId}/sync/status`);
      setSyncState(data);
      setSelectedInterval(data.interval || '5m');
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchSyncStatus();
    // Poll sync status every 30s
    const interval = setInterval(fetchSyncStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchSyncStatus]);

  const handleSyncNow = async () => {
    setSyncing(true);
    setError('');
    setSuccessMsg('');
    try {
      const { data } = await api.post(`/drive/rooms/${roomId}/sync/trigger`);
      setSuccessMsg(data.message);
      fetchSyncStatus();
      if (onSyncComplete) onSyncComplete(data);
    } catch (err) {
      const msg = err.response?.data?.error || 'Sync failed.';
      setError(msg);
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setError('');
    try {
      const { data } = await api.post(`/drive/rooms/${roomId}/sync/settings`, {
        interval: selectedInterval,
        enabled: true,
      });
      setSuccessMsg('Sync settings saved.');
      fetchSyncStatus();
      setShowSettings(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const formatCountdown = (dateStr) => {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff <= 0) return 'Due now';
    if (diff < 60000) return `in ${Math.ceil(diff / 1000)}s`;
    if (diff < 3600000) return `in ${Math.ceil(diff / 60000)}m`;
    return `in ${Math.ceil(diff / 3600000)}h`;
  };

  if (loading) return null;
  if (!syncState) return null;

  const isError = syncState.status === 'error';
  const isSyncing = syncState.status === 'syncing' || syncing;
  const hasAuthError = isError && ['TOKEN_EXPIRED', 'DRIVE_ACCESS_REVOKED', 'INSUFFICIENT_SCOPE'].includes(syncState.error);

  return (
    <div className="sync-settings-panel">
      {/* Header */}
      <div className="sync-header">
        <div className="sync-title">
          <HiOutlineSignal className="sync-icon" />
          <span>Drive Auto-Sync</span>
        </div>
        <button
          className="btn-icon"
          onClick={() => setShowSettings(!showSettings)}
          title="Sync Settings"
        >
          <HiOutlineCog6Tooth />
        </button>
      </div>

      {/* Status */}
      <div className="sync-status-row">
        <div className={`sync-status-badge ${isError ? 'error' : isSyncing ? 'syncing' : 'idle'}`}>
          {isError ? (
            <HiOutlineExclamationTriangle />
          ) : isSyncing ? (
            <HiOutlineArrowPath className="spin" />
          ) : (
            <HiOutlineCheckCircle />
          )}
          <span>
            {isError ? 'Error' : isSyncing ? 'Syncing...' : 'Active'}
          </span>
        </div>

        <div className="sync-meta">
          <span className="sync-meta-item">
            <HiOutlineClock />
            {INTERVAL_LABELS[syncState.interval] || syncState.interval}
          </span>
          <span className="sync-meta-item">
            Last: {formatTimeAgo(syncState.lastSyncedAt)}
          </span>
          {syncState.nextSyncAt && syncState.interval !== 'manual' && (
            <span className="sync-meta-item">
              Next: {formatCountdown(syncState.nextSyncAt)}
            </span>
          )}
        </div>
      </div>

      {/* Auth Error Banner */}
      {hasAuthError && (
        <div className="sync-auth-error">
          <HiOutlineExclamationTriangle />
          <span>Google Drive access needs attention.</span>
          <button className="btn-reconnect" onClick={onReconnectDrive}>
            Reconnect Drive
          </button>
        </div>
      )}

      {/* Non-auth Error */}
      {isError && !hasAuthError && (
        <div className="sync-error-banner">
          <HiOutlineExclamationTriangle />
          <span>{syncState.error || 'Unknown sync error.'}</span>
        </div>
      )}

      {/* Sync Now Button */}
      <button
        className="btn-sync-now"
        onClick={handleSyncNow}
        disabled={isSyncing || hasAuthError}
      >
        <HiOutlineArrowPath className={isSyncing ? 'spin' : ''} />
        {isSyncing ? 'Syncing...' : 'Sync Now'}
      </button>

      {/* Success/Error Messages */}
      {successMsg && <div className="sync-success-msg">{successMsg}</div>}
      {error && <div className="sync-error-msg">{error}</div>}

      {/* Settings Dropdown */}
      {showSettings && (
        <div className="sync-settings-dropdown">
          <label className="sync-settings-label">Sync Interval</label>
          <div className="sync-interval-options">
            {Object.entries(INTERVAL_LABELS).map(([value, label]) => (
              <label key={value} className="sync-interval-option">
                <input
                  type="radio"
                  name="syncInterval"
                  value={value}
                  checked={selectedInterval === value}
                  onChange={(e) => setSelectedInterval(e.target.value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <button
            className="btn-save-settings"
            onClick={handleSaveSettings}
            disabled={savingSettings}
          >
            {savingSettings ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}

      <style>{`
        .sync-settings-panel {
          background: rgba(30, 32, 44, 0.7);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 20px;
          margin-top: 16px;
          backdrop-filter: blur(12px);
        }
        .sync-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .sync-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
          font-weight: 600;
          color: #e0e0e0;
        }
        .sync-icon {
          color: #6c63ff;
          font-size: 20px;
        }
        .btn-icon {
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
          font-size: 20px;
          padding: 4px;
          border-radius: 8px;
          transition: all 0.2s;
        }
        .btn-icon:hover {
          color: #6c63ff;
          background: rgba(108,99,255,0.1);
        }
        .sync-status-row {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .sync-status-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 500;
        }
        .sync-status-badge.idle {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
        }
        .sync-status-badge.syncing {
          background: rgba(108, 99, 255, 0.15);
          color: #6c63ff;
        }
        .sync-status-badge.error {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .sync-meta {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
        }
        .sync-meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #888;
        }
        .sync-auth-error {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 10px;
          margin-bottom: 14px;
          color: #ef4444;
          font-size: 13px;
        }
        .btn-reconnect {
          margin-left: auto;
          padding: 6px 14px;
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.4);
          border-radius: 8px;
          color: #ef4444;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .btn-reconnect:hover {
          background: rgba(239, 68, 68, 0.3);
        }
        .sync-error-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: rgba(251, 146, 60, 0.1);
          border-radius: 8px;
          margin-bottom: 14px;
          color: #fb923c;
          font-size: 13px;
        }
        .btn-sync-now {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 10px;
          background: linear-gradient(135deg, #6c63ff, #7c3aed);
          border: none;
          border-radius: 10px;
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-sync-now:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(108,99,255,0.3);
        }
        .btn-sync-now:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .sync-success-msg {
          margin-top: 10px;
          padding: 8px 12px;
          background: rgba(34, 197, 94, 0.1);
          border-radius: 8px;
          color: #22c55e;
          font-size: 13px;
          text-align: center;
        }
        .sync-error-msg {
          margin-top: 10px;
          padding: 8px 12px;
          background: rgba(239, 68, 68, 0.1);
          border-radius: 8px;
          color: #ef4444;
          font-size: 13px;
          text-align: center;
        }
        .sync-settings-dropdown {
          margin-top: 14px;
          padding: 16px;
          background: rgba(20, 22, 34, 0.6);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
        }
        .sync-settings-label {
          font-size: 13px;
          font-weight: 600;
          color: #ccc;
          margin-bottom: 10px;
          display: block;
        }
        .sync-interval-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 14px;
        }
        .sync-interval-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          color: #bbb;
          transition: background 0.15s;
        }
        .sync-interval-option:hover {
          background: rgba(108,99,255,0.08);
        }
        .sync-interval-option input[type="radio"] {
          accent-color: #6c63ff;
        }
        .btn-save-settings {
          width: 100%;
          padding: 8px;
          background: rgba(108,99,255,0.15);
          border: 1px solid rgba(108,99,255,0.3);
          border-radius: 8px;
          color: #6c63ff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-save-settings:hover:not(:disabled) {
          background: rgba(108,99,255,0.25);
        }
        .btn-save-settings:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default SyncSettingsPanel;
