import React from 'react';
import {
  FiX,
  FiRefreshCw,
  FiPause,
  FiPlay,
  FiCheckCircle,
  FiClock,
  FiAlertTriangle,
  FiActivity,
  FiCpu,
  FiServer,
} from 'react-icons/fi';
import { useProcessingProgress } from '../hooks/useProcessingProgress';

const FAILURE_LABELS = {
  DRIVE_DOWNLOAD_FAILED: 'Google Drive Download Error',
  FACE_SERVICE_UNAVAILABLE: 'Face Recognition Service Timeout / Unavailable',
  INVALID_IMAGE: 'Invalid or Corrupt Image File',
  NO_FACE: 'No Face Detected in Image',
  TIMEOUT: 'Processing Timeout',
  GOOGLE_AUTH_ERROR: 'Google Drive Auth / Permission Error',
  UNKNOWN: 'Other System Errors',
};

const ProcessingCenterModal = ({ isOpen, onClose, roomId }) => {
  const {
    metrics,
    failureBreakdown,
    systemHealth,
    loading,
    actionLoading,
    retryFailed,
    pauseProcessing,
    resumeProcessing,
  } = useProcessingProgress(roomId);

  if (!isOpen) return null;

  const total = metrics?.total || 0;
  const indexed = metrics?.indexed || 0;
  const processing = metrics?.processing || 0;
  const queued = metrics?.queued || 0;
  const failed = (metrics?.failed || 0) + (metrics?.permanentlyFailed || 0);

  const percentage = total > 0 ? Math.round((indexed / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="glass max-w-3xl w-full rounded-2xl border border-surface-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-surface-800 flex items-center justify-between bg-surface-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center">
              <FiActivity className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Processing Center</h2>
              <p className="text-xs text-surface-400">High-Concurrency Distributed Indexing Dashboard</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-surface-400 hover:text-white hover:bg-surface-800 transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          {/* Progress Section */}
          <div className="bg-surface-900/60 rounded-2xl p-6 border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-surface-200">Overall Progress</span>
              <span className="text-2xl font-bold gradient-text">{percentage}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-surface-950 rounded-full h-4 p-0.5 border border-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary-500 via-purple-500 to-accent-500 transition-all duration-500 ease-out shadow-[0_0_15px_#6366f1]"
                style={{ width: `${percentage}%` }}
              />
            </div>

            <div className="text-xs text-surface-400 flex items-center justify-between">
              <span>{indexed.toLocaleString()} of {total.toLocaleString()} photos indexed</span>
              <span>BullMQ Queue Status: Active</span>
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-surface-900/50 border border-emerald-500/20 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-emerald-400 mb-1">
                <FiCheckCircle className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Indexed</span>
              </div>
              <p className="text-2xl font-bold text-white">{indexed.toLocaleString()}</p>
            </div>

            <div className="bg-surface-900/50 border border-indigo-500/20 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-indigo-400 mb-1">
                <FiCpu className="w-4 h-4 animate-pulse" />
                <span className="text-xs font-semibold uppercase">Processing</span>
              </div>
              <p className="text-2xl font-bold text-white">{processing.toLocaleString()}</p>
            </div>

            <div className="bg-surface-900/50 border border-amber-500/20 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-amber-400 mb-1">
                <FiClock className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Queued</span>
              </div>
              <p className="text-2xl font-bold text-white">{queued.toLocaleString()}</p>
            </div>

            <div className="bg-surface-900/50 border border-rose-500/20 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-rose-400 mb-1">
                <FiAlertTriangle className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Failed</span>
              </div>
              <p className="text-2xl font-bold text-white">{failed.toLocaleString()}</p>
            </div>
          </div>

          {/* Failure Categories Breakdown */}
          {failed > 0 && (
            <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-5 space-y-3">
              <h4 className="text-sm font-semibold text-rose-200 flex items-center gap-2">
                <FiAlertTriangle className="w-4 h-4 text-rose-400" />
                Failure Reason Categories ({failed})
              </h4>
              <div className="divide-y divide-rose-500/10">
                {Object.entries(failureBreakdown).map(([code, count]) => (
                  <div key={code} className="py-2 flex items-center justify-between text-xs">
                    <span className="text-surface-300">{FAILURE_LABELS[code] || code}</span>
                    <span className="font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System Health Overview */}
          <div className="bg-surface-900/40 border border-white/5 rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-2">
              <FiServer className="w-4 h-4 text-surface-300" />
              System Infrastructure Health
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-surface-950/60 p-3 rounded-xl flex items-center justify-between">
                <span className="text-surface-400">Redis Queue</span>
                <span className={`font-semibold ${systemHealth?.redis ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {systemHealth?.redis ? '✓ Connected' : '❌ Offline'}
                </span>
              </div>
              <div className="bg-surface-950/60 p-3 rounded-xl flex items-center justify-between">
                <span className="text-surface-400">Workers</span>
                <span className="font-semibold text-emerald-400">{systemHealth?.workers || '3 Active'}</span>
              </div>
              <div className="bg-surface-950/60 p-3 rounded-xl flex items-center justify-between">
                <span className="text-surface-400">Face Service</span>
                <span className={`font-semibold ${systemHealth?.faceService ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {systemHealth?.faceService ? '✓ Healthy' : '⚠ Degraded'}
                </span>
              </div>
              <div className="bg-surface-950/60 p-3 rounded-xl flex items-center justify-between">
                <span className="text-surface-400">Google Drive</span>
                <span className={`font-semibold ${systemHealth?.driveConnected ? 'text-emerald-400' : 'text-surface-400'}`}>
                  {systemHealth?.driveConnected ? '✓ Connected' : 'Local Mode'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-surface-800 bg-surface-900/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => pauseProcessing()}
              disabled={actionLoading}
              className="px-4 py-2.5 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-200 text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50 border border-white/5"
            >
              <FiPause className="w-4 h-4 text-amber-400" />
              Pause Processing
            </button>
            <button
              onClick={() => resumeProcessing()}
              disabled={actionLoading}
              className="px-4 py-2.5 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-200 text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50 border border-white/5"
            >
              <FiPlay className="w-4 h-4 text-emerald-400" />
              Resume Processing
            </button>
          </div>

          <button
            onClick={() => retryFailed(false)}
            disabled={actionLoading || failed === 0}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-indigo-600 hover:from-primary-600 hover:to-indigo-700 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-lg disabled:opacity-50"
          >
            <FiRefreshCw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
            Retry Failed ({failed})
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProcessingCenterModal;
