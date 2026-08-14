import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  HiOutlineCheck,
  HiOutlineXMark,
  HiOutlineNoSymbol,
  HiOutlineUserGroup,
  HiOutlineClock,
} from 'react-icons/hi2';

const UploadRequestsPanel = ({ roomId }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [filter, setFilter] = useState('PENDING');

  const fetchRequests = useCallback(async () => {
    try {
      const params = filter ? { status: filter } : {};
      const { data } = await api.get(`/rooms/${roomId}/upload-requests`, { params });
      setRequests(data.requests);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [roomId, filter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleAction = async (requestId, action) => {
    setActionLoading(requestId);
    try {
      await api.patch(`/upload-requests/${requestId}/${action}`);
      fetchRequests();
    } catch (err) {
      console.error(`Failed to ${action} request:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

  const getStatusBadge = (status) => {
    const styles = {
      PENDING: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      APPROVED: 'bg-green-500/15 text-green-400 border-green-500/30',
      REJECTED: 'bg-red-500/15 text-red-400 border-red-500/30',
      REVOKED: 'bg-surface-600/30 text-surface-300 border-surface-500/30',
    };
    const icons = {
      PENDING: <HiOutlineClock className="text-sm" />,
      APPROVED: <HiOutlineCheck className="text-sm" />,
      REJECTED: <HiOutlineXMark className="text-sm" />,
      REVOKED: <HiOutlineNoSymbol className="text-sm" />,
    };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${styles[status]}`}>
        {icons[status]}
        {status}
      </span>
    );
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="glass rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <HiOutlineUserGroup className="text-xl text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Upload Requests</h3>
            {filter === 'PENDING' && pendingCount > 0 && (
              <p className="text-xs text-amber-400">{pendingCount} pending</p>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-surface-800/60 rounded-xl p-1">
          {['PENDING', 'APPROVED', 'ALL'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f === 'ALL' ? '' : f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                (f === 'ALL' && !filter) || filter === f
                  ? 'bg-surface-700 text-white'
                  : 'text-surface-300 hover:text-white'
              }`}
            >
              {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      )}

      {/* Empty state */}
      {!loading && requests.length === 0 && (
        <div className="text-center py-8">
          <p className="text-surface-300 text-sm">
            {filter === 'PENDING'
              ? 'No pending upload requests'
              : 'No upload requests found'}
          </p>
        </div>
      )}

      {/* Request list */}
      {!loading && requests.length > 0 && (
        <div className="space-y-3">
          {requests.map((req) => (
            <div
              key={req._id}
              className="bg-surface-800/40 border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                {/* User info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center flex-shrink-0">
                    {req.requesterId?.profileImage ? (
                      <img
                        src={req.requesterId.profileImage}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-semibold text-sm">
                        {req.requesterId?.name?.[0]?.toUpperCase() || '?'}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-medium text-sm truncate">
                      {req.requesterId?.name || 'Unknown User'}
                    </p>
                    <p className="text-surface-400 text-xs truncate">
                      {req.requesterId?.email}
                    </p>
                  </div>
                </div>

                {/* Status + time */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {getStatusBadge(req.status)}
                  <span className="text-xs text-surface-400">
                    {formatTime(req.createdAt)}
                  </span>
                </div>
              </div>

              {/* Message */}
              {req.message && (
                <div className="mt-3 bg-surface-900/50 rounded-lg px-3 py-2 border border-white/5">
                  <p className="text-surface-200 text-sm italic">"{req.message}"</p>
                </div>
              )}

              {/* Action buttons */}
              {req.status === 'PENDING' && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleAction(req._id, 'approve')}
                    disabled={actionLoading === req._id}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 transition-colors cursor-pointer text-sm font-medium disabled:opacity-50"
                  >
                    <HiOutlineCheck className="text-base" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleAction(req._id, 'reject')}
                    disabled={actionLoading === req._id}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition-colors cursor-pointer text-sm font-medium disabled:opacity-50"
                  >
                    <HiOutlineXMark className="text-base" />
                    Reject
                  </button>
                </div>
              )}

              {/* Revoke button for approved */}
              {req.status === 'APPROVED' && (
                <div className="mt-3">
                  <button
                    onClick={() => handleAction(req._id, 'revoke')}
                    disabled={actionLoading === req._id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-surface-300 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    <HiOutlineNoSymbol className="text-sm" />
                    Revoke Access
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UploadRequestsPanel;
