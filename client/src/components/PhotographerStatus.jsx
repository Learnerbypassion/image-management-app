import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import UploadRequestModal from './UploadRequestModal';
import {
  HiOutlineLockClosed,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineCloudArrowUp,
  HiOutlineCamera,
} from 'react-icons/hi2';

const PhotographerStatus = ({ roomId, onStatusChange }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await api.get(`/rooms/${roomId}/upload-requests/my-status`);
      setStatus(data);
      onStatusChange?.(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [roomId, onStatusChange]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSubmitRequest = async (message) => {
    try {
      await api.post(`/rooms/${roomId}/upload-requests`, { message });
      setShowRequestModal(false);
      fetchStatus();
    } catch (err) {
      throw err;
    }
  };

  if (loading || !status) return null;

  // Owner doesn't see this component
  if (status.role === 'OWNER') return null;

  // Already approved photographer
  if (status.canUpload) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 mb-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <HiOutlineCheckCircle className="text-xl text-green-400" />
          </div>
          <div>
            <p className="text-green-400 font-semibold text-sm">Photographer Access</p>
            <p className="text-green-300/70 text-xs">You can upload photos to this event</p>
          </div>
        </div>
      </div>
    );
  }

  const requestStatus = status.request?.status;

  // Pending request
  if (requestStatus === 'PENDING') {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 mb-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <HiOutlineClock className="text-xl text-amber-400" />
          </div>
          <div>
            <p className="text-amber-400 font-semibold text-sm">Request Pending</p>
            <p className="text-amber-300/70 text-xs">
              Waiting for the event organizer to review your request
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Rejected or Revoked — allow re-request
  if (requestStatus === 'REJECTED' || requestStatus === 'REVOKED') {
    return (
      <>
        <div className="bg-surface-800/40 border border-white/5 rounded-2xl p-5 mb-6 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
              <HiOutlineXCircle className="text-xl text-red-400" />
            </div>
            <div className="flex-1">
              <p className="text-surface-200 font-semibold text-sm">
                {requestStatus === 'REJECTED' ? 'Request Rejected' : 'Access Revoked'}
              </p>
              <p className="text-surface-400 text-xs mb-3">
                {requestStatus === 'REJECTED'
                  ? 'Your photographer request was not approved'
                  : 'Your photographer access has been revoked'}
              </p>
              <button
                onClick={() => setShowRequestModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 transition-colors cursor-pointer text-sm font-medium"
              >
                <HiOutlineCamera className="text-base" />
                Request Again
              </button>
            </div>
          </div>
        </div>

        {showRequestModal && (
          <UploadRequestModal
            roomId={roomId}
            onSubmit={handleSubmitRequest}
            onClose={() => setShowRequestModal(false)}
          />
        )}
      </>
    );
  }

  // No request yet — show CTA
  return (
    <>
      <div className="bg-surface-800/40 border border-white/5 rounded-2xl p-5 mb-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-xl bg-surface-700/60 flex items-center justify-center flex-shrink-0">
              <HiOutlineLockClosed className="text-xl text-surface-300" />
            </div>
            <div>
              <p className="text-surface-200 font-semibold text-sm">Want to upload event photos?</p>
              <p className="text-surface-400 text-xs">
                Request photographer access to contribute photos
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowRequestModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold hover:from-amber-600 hover:to-orange-700 transition-all cursor-pointer text-sm shadow-lg shadow-amber-500/20"
          >
            <HiOutlineCloudArrowUp className="text-lg" />
            Request Upload Access
          </button>
        </div>
      </div>

      {showRequestModal && (
        <UploadRequestModal
          roomId={roomId}
          onSubmit={handleSubmitRequest}
          onClose={() => setShowRequestModal(false)}
        />
      )}
    </>
  );
};

export default PhotographerStatus;
