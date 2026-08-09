import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import ProcessingProgress from '../components/ProcessingProgress';
import api from '../services/api';
import {
  HiOutlineCloudArrowUp,
  HiOutlineBolt,
  HiOutlineCamera,
  HiOutlineTrash,
  HiOutlineClipboardDocument,
} from 'react-icons/hi2';

const Room = () => {
  const { roomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const isOwner = room && user && room.ownerId === user._id;

  const fetchRoom = useCallback(async () => {
    try {
      const { data } = await api.get(`/rooms/${roomId}`);
      setRoom(data.room);
    } catch (err) {
      setError('Room not found or access denied.');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  // Poll for indexing status
  useEffect(() => {
    if (room?.status !== 'indexing') return;

    const interval = setInterval(async () => {
      try {
        const { data } = await api.get(`/rooms/${roomId}/index/status`);
        setRoom((prev) => ({
          ...prev,
          status: data.status,
          processedPhotos: data.processed,
          facesDetected: data.facesDetected,
        }));
        if (data.status !== 'indexing') {
          clearInterval(interval);
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [room?.status, roomId]);

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError('');
    setSuccessMsg('');

    const formData = new FormData();
    for (const file of files) {
      formData.append('photos', file);
    }

    try {
      const { data } = await api.post(`/rooms/${roomId}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccessMsg(data.message);
      fetchRoom();
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleIndex = async () => {
    setIndexing(true);
    setError('');
    setSuccessMsg('');

    try {
      const { data } = await api.post(`/rooms/${roomId}/index`);
      setSuccessMsg(data.message);
      fetchRoom();
    } catch (err) {
      setError(err.response?.data?.error || 'Indexing failed.');
    } finally {
      setIndexing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this room? This cannot be undone.')) return;

    try {
      await api.delete(`/rooms/${roomId}`);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete room.');
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="spinner" style={{ width: 48, height: 48 }} />
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <p className="text-red-400 text-lg mb-4">{error}</p>
        <Link to="/" className="text-primary-400 hover:underline">
          Go Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="animate-fade-in-up">
        {/* Room Header */}
        <div className="glass rounded-2xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{room.name}</h1>
              {room.organization && (
                <p className="text-surface-200 mt-0.5">{room.organization}</p>
              )}
              {room.description && (
                <p className="text-surface-200 text-sm mt-1">{room.description}</p>
              )}
            </div>

            {/* Room code */}
            <button
              onClick={copyCode}
              className="flex items-center gap-3 bg-surface-800/50 rounded-xl px-5 py-3 hover:bg-surface-800 transition-colors cursor-pointer"
            >
              <div>
                <p className="text-xs text-surface-200">Room Code</p>
                <p className="text-2xl font-mono font-bold tracking-widest gradient-text">
                  {room.code}
                </p>
              </div>
              <HiOutlineClipboardDocument className="text-xl text-surface-200" />
              {copied && (
                <span className="text-xs text-green-400">Copied!</span>
              )}
            </button>
          </div>
        </div>

        {/* Status messages */}
        {successMsg && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 mb-6">
            <p className="text-green-400 text-sm">{successMsg}</p>
          </div>
        )}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-6">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Indexing Progress */}
        <div className="mb-6">
          <ProcessingProgress
            status={room.status}
            total={room.totalPhotos}
            processed={room.processedPhotos}
            facesDetected={room.facesDetected}
          />
        </div>

        {/* Actions */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {/* Upload Photos (owner only) */}
          {isOwner && (
            <label className="glass rounded-2xl p-6 card-hover cursor-pointer group text-center">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <HiOutlineCloudArrowUp className="text-white text-2xl" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                {uploading ? 'Uploading...' : 'Upload Photos'}
              </h3>
              <p className="text-sm text-surface-200 mt-1">
                Select event photos to upload
              </p>
              {uploading && (
                <div className="spinner mx-auto mt-3" />
              )}
            </label>
          )}

          {/* Start Indexing (owner only) */}
          {isOwner && room.totalPhotos > 0 && (
            <button
              onClick={handleIndex}
              disabled={indexing || room.status === 'indexing'}
              className="glass rounded-2xl p-6 card-hover text-center cursor-pointer group disabled:opacity-50"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <HiOutlineBolt className="text-white text-2xl" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                {indexing ? 'Indexing...' : 'Start Indexing'}
              </h3>
              <p className="text-sm text-surface-200 mt-1">
                Detect faces in uploaded photos
              </p>
            </button>
          )}

          {/* Find My Photos */}
          {room.status === 'ready' && (
            <Link
              to={`/room/${roomId}/selfie`}
              className="glass rounded-2xl p-6 card-hover text-center group"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <HiOutlineCamera className="text-white text-2xl" />
              </div>
              <h3 className="text-lg font-semibold text-white">Find My Photos</h3>
              <p className="text-sm text-surface-200 mt-1">
                Take a selfie to find your photos
              </p>
            </Link>
          )}
        </div>

        {/* Delete Room (owner only) */}
        {isOwner && (
          <div className="text-center">
            <button
              onClick={handleDelete}
              className="text-sm text-surface-200 hover:text-red-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <HiOutlineTrash />
              Delete Room
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Room;
