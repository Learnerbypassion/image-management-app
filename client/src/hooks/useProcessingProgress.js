import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { getSocket, joinRoomChannel, leaveRoomChannel } from '../services/socket';

export const useProcessingProgress = (roomId) => {
  const [data, setData] = useState({
    status: 'idle',
    metrics: {
      total: 0,
      uploaded: 0,
      queued: 0,
      processing: 0,
      indexed: 0,
      failed: 0,
      permanentlyFailed: 0,
    },
    failureBreakdown: {},
    systemHealth: {
      redis: true,
      faceService: true,
      driveConnected: true,
      workers: 'Active',
    },
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!roomId) return;
    try {
      const res = await api.get(`/rooms/${roomId}/processing`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch processing status REST API:', err);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    fetchStatus();

    // Poll every 5s to keep data fresh (supplement Socket.IO)
    const pollInterval = setInterval(fetchStatus, 5000);

    // Socket.IO Channel Subscription
    const socket = getSocket();
    joinRoomChannel(roomId);

    const handleSummaryUpdate = (summary) => {
      if (summary.roomId === roomId.toString()) {
        setData((prev) => ({
          ...prev,
          status: summary.status || prev.status,
          metrics: {
            total: summary.total ?? prev.metrics.total,
            uploaded: summary.uploaded ?? prev.metrics.uploaded,
            queued: summary.queued ?? prev.metrics.queued,
            processing: summary.processing ?? prev.metrics.processing,
            indexed: summary.indexed ?? prev.metrics.indexed,
            failed: summary.failed ?? prev.metrics.failed,
            permanentlyFailed: prev.metrics.permanentlyFailed,
          },
        }));
      }
    };

    socket.on('processing:summary', handleSummaryUpdate);

    return () => {
      clearInterval(pollInterval);
      socket.off('processing:summary', handleSummaryUpdate);
      leaveRoomChannel(roomId);
    };
  }, [roomId, fetchStatus]);

  const retryFailed = async (includePermanentlyFailed = false) => {
    setActionLoading(true);
    try {
      await api.post(`/rooms/${roomId}/processing/retry`, {
        includePermanentlyFailed,
      });
      await fetchStatus();
    } catch (err) {
      console.error('Failed to retry jobs:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const pauseProcessing = async () => {
    setActionLoading(true);
    try {
      await api.post(`/rooms/${roomId}/processing/pause`);
      await fetchStatus();
    } catch (err) {
      console.error('Failed to pause processing:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const resumeProcessing = async () => {
    setActionLoading(true);
    try {
      await api.post(`/rooms/${roomId}/processing/resume`);
      await fetchStatus();
    } catch (err) {
      console.error('Failed to resume processing:', err);
    } finally {
      setActionLoading(false);
    }
  };

  return {
    ...data,
    loading,
    actionLoading,
    refetch: fetchStatus,
    retryFailed,
    pauseProcessing,
    resumeProcessing,
  };
};

export default useProcessingProgress;
