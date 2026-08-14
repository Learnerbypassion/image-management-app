import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import api from '../services/api';
import PrivacyModal from '../components/PrivacyModal';
import PhotoGrid from '../components/PhotoGrid';
import { HiOutlineCamera, HiOutlineSparkles, HiOutlineLockClosed, HiOutlineCheckCircle, HiOutlineFolder } from 'react-icons/hi2';

const PublicJoin = () => {
  const { publicToken } = useParams();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  // Selfie upload & match state
  const [selfieFile, setSelfieFile] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState(null);
  const [matchError, setMatchError] = useState('');

  const fetchRoom = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/rooms/token/${publicToken}`);
      setRoom(data.room);
    } catch (err) {
      setError(err.response?.data?.error || 'Event room not found or link has expired.');
    } finally {
      setLoading(false);
    }
  }, [publicToken]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  const handleStartSelfie = () => {
    if (!privacyAccepted) {
      setShowPrivacyModal(true);
    } else {
      triggerFileInput();
    }
  };

  const handlePrivacyAccept = () => {
    setPrivacyAccepted(true);
    setShowPrivacyModal(false);
    triggerFileInput();
  };

  const triggerFileInput = () => {
    document.getElementById('public-selfie-input')?.click();
  };

  const handleSelfieChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelfieFile(file);
    setSelfiePreview(URL.createObjectURL(file));
    setMatchError('');

    // Trigger match
    await processMatch(file);
  };

  const processMatch = async (file) => {
    if (!room) return;

    setMatching(true);
    setMatchError('');

    const formData = new FormData();
    formData.append('selfie', file);

    try {
      const { data } = await api.post(`/rooms/${room._id}/match`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMatchResult(data);
    } catch (err) {
      setMatchError(err.response?.data?.error || 'Selfie matching failed. Please try another photo.');
    } finally {
      setMatching(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="spinner" style={{ width: 48, height: 48 }} />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 glass rounded-3xl text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
          ✕
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Event Not Found</h3>
        <p className="text-surface-200 text-sm mb-6">{error}</p>
        <Link to="/" className="btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold inline-block">
          Go Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 animate-fade-in">
      {/* Event Header Banner */}
      <div className="glass rounded-3xl p-6 sm:p-8 mb-8 border border-white/10 relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            {room.organization && (
              <span className="text-xs font-semibold text-primary-400 tracking-wider uppercase mb-1 block">
                {room.organization}
              </span>
            )}
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">{room.name}</h1>
            {room.description && <p className="text-surface-200 text-sm mt-2 max-w-xl">{room.description}</p>}
          </div>

          <div className="bg-surface-800/80 rounded-2xl px-5 py-3 border border-white/5 text-right">
            <span className="text-xs text-surface-400 block font-medium">Event Photos</span>
            <span className="text-2xl font-bold text-white">{room.totalPhotos}</span>
          </div>
        </div>
      </div>

      {/* Action Section */}
      <div className="glass rounded-3xl p-6 sm:p-8 text-center mb-8 border border-white/10">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-primary-500 to-indigo-600 text-white flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary-900/30">
          <HiOutlineCamera className="text-3xl" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">Find Every Photo You're In</h2>
        <p className="text-surface-200 text-sm max-w-md mx-auto mb-6">
          Take or upload one selfie. SnapFind will instantly search this event's photos using AI face matching.
        </p>

        <input
          type="file"
          id="public-selfie-input"
          accept="image/*"
          capture="user"
          onChange={handleSelfieChange}
          className="hidden"
        />

        <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
          <button
            onClick={handleStartSelfie}
            disabled={matching}
            className="btn-primary py-3.5 px-6 rounded-2xl font-bold text-white cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary-900/40 text-base"
          >
            {matching ? (
              <>
                <div className="spinner" style={{ width: 20, height: 20 }} />
                <span>Matching Faces...</span>
              </>
            ) : (
              <>
                <HiOutlineSparkles className="text-xl" />
                <span>Take a Selfie to Match</span>
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-surface-400 mt-4 flex items-center justify-center gap-1">
          <HiOutlineLockClosed className="text-emerald-400" />
          <span>Zero-storage guarantee: Selfies are processed in memory and never saved to disk.</span>
        </p>
      </div>

      {/* Match Results Error */}
      {matchError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-center mb-8">
          <p className="text-red-400 text-sm font-medium">{matchError}</p>
        </div>
      )}

      {/* Match Results Gallery */}
      {matchResult && (
        <div className="animate-fade-in-up pb-32">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-bold text-white flex items-center gap-2">
              <span>Your Matched Photos</span>
              <span className="bg-primary-500/20 text-primary-400 text-sm font-extrabold px-3 py-0.5 rounded-full border border-primary-500/30">
                {matchResult.count}
              </span>
            </h3>
          </div>

          <PhotoGrid photos={matchResult.photos} />
        </div>
      )}

      {/* Privacy Consent Modal */}
      <PrivacyModal
        isOpen={showPrivacyModal}
        onAccept={handlePrivacyAccept}
        onCancel={() => setShowPrivacyModal(false)}
      />
    </div>
  );
};

export default PublicJoin;
