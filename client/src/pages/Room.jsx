import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import ProcessingProgress from '../components/ProcessingProgress';
import DriveFolderPicker from '../components/DriveFolderPicker';
import QRCodeModal from '../components/QRCodeModal';
import PhotographerStatus from '../components/PhotographerStatus';
import UploadRequestsPanel from '../components/UploadRequestsPanel';
import api from '../services/api';
import {
  HiOutlineCloudArrowUp,
  HiOutlineBolt,
  HiOutlineCamera,
  HiOutlineTrash,
  HiOutlineClipboardDocument,
  HiOutlineFolder,
  HiOutlineCheckCircle,
  HiOutlineQrCode,
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

  // Google Drive state
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [indexingDrive, setIndexingDrive] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);

  // Photographer status (updated by PhotographerStatus component)
  const [photographerStatus, setPhotographerStatus] = useState(null);

  const isOwner = room && user && room.ownerId === user._id;
  // canUpload: owner OR approved photographer
  const canUpload = isOwner || photographerStatus?.canUpload;

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

  const checkDriveStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/drive/status');
      setIsDriveConnected(data.isConnected);
    } catch {
      setIsDriveConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchRoom();
    checkDriveStatus();
  }, [fetchRoom, checkDriveStatus]);

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

  const handleConnectDrive = async () => {
    try {
      const { data } = await api.get('/drive/connect');
      window.location.href = data.url;
    } catch (err) {
      setError('Failed to initiate Google Drive authentication. Please check your credentials in .env.');
    }
  };

  const handleIndexDrive = async () => {
    setIndexingDrive(true);
    setError('');
    setSuccessMsg('');

    try {
      const { data } = await api.post(`/drive/rooms/${roomId}/index-drive`);
      setSuccessMsg(data.message);
      fetchRoom();
    } catch (err) {
      setError(err.response?.data?.error || 'Drive photo indexing failed.');
    } finally {
      setIndexingDrive(false);
    }
  };

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

              {/* Linked Drive Folder Badge */}
              {room.driveFolderId && (
                <div className="inline-flex items-center gap-2 mt-3 bg-primary-600/20 border border-primary-500/40 rounded-lg px-3 py-1.5 text-xs text-primary-300">
                  <HiOutlineFolder className="text-primary-400 text-sm" />
                  <span>Drive Folder: <strong>{room.driveFolderName || room.driveFolderId}</strong></span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowQRCode(true)}
                className="flex items-center gap-2 bg-primary-600/20 border border-primary-500/40 rounded-xl px-4 py-3 hover:bg-primary-600/30 text-primary-300 transition-colors cursor-pointer"
                title="View & Share Event QR Code"
              >
                <HiOutlineQrCode className="text-xl text-primary-400" />
                <span className="text-xs font-semibold">Event QR Code</span>
              </button>

              {/* Room code */}
              <button
                onClick={copyCode}
                className="flex items-center gap-3 bg-surface-800/50 rounded-xl px-5 py-3 hover:bg-surface-800 transition-colors cursor-pointer border border-white/5"
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
        </div>

        {/* Photographer Status Banner (non-owner members) */}
        {!isOwner && (
          <PhotographerStatus
            roomId={roomId}
            onStatusChange={setPhotographerStatus}
          />
        )}

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

        {/* Actions Section */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {/* Option A: Connect Google Drive (owner only) */}
          {isOwner && !isDriveConnected && (
            <button
              onClick={handleConnectDrive}
              className="glass rounded-2xl p-6 card-hover text-center cursor-pointer group"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <HiOutlineCloudArrowUp className="text-white text-2xl" />
              </div>
              <h3 className="text-lg font-semibold text-white">Connect Google Drive</h3>
              <p className="text-sm text-surface-200 mt-1">
                Link your Google Drive account to select event folders
              </p>
            </button>
          )}

          {/* Option B: Select Drive Folder (owner only, when Drive is connected) */}
          {isOwner && isDriveConnected && (
            <button
              onClick={() => setShowFolderPicker(true)}
              className="glass rounded-2xl p-6 card-hover text-center cursor-pointer group"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <HiOutlineFolder className="text-white text-2xl" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                {room.driveFolderId ? 'Change Drive Folder' : 'Select Drive Folder'}
              </h3>
              <p className="text-sm text-surface-200 mt-1">
                {room.driveFolderName ? room.driveFolderName : 'Choose a photo folder from your Drive'}
              </p>
            </button>
          )}

          {/* Option C: Index Google Drive Photos (canUpload + Drive connected + folder linked) */}
          {canUpload && isDriveConnected && room.driveFolderId && (
            <button
              onClick={handleIndexDrive}
              disabled={indexingDrive || room.status === 'indexing'}
              className="glass rounded-2xl p-6 card-hover text-center cursor-pointer group disabled:opacity-50"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <HiOutlineBolt className="text-white text-2xl" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                {indexingDrive ? 'Indexing Drive...' : 'Index Google Drive'}
              </h3>
              <p className="text-sm text-surface-200 mt-1">
                Stream & detect faces directly from Drive
              </p>
            </button>
          )}

          {/* Option D: Local Upload Photos (canUpload) */}
          {canUpload && (
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
                {uploading ? 'Uploading...' : 'Upload Local Photos'}
              </h3>
              <p className="text-sm text-surface-200 mt-1">
                Upload photos from local storage
              </p>
              {uploading && (
                <div className="spinner mx-auto mt-3" />
              )}
            </label>
          )}

          {/* Option E: Start Local Indexing (canUpload, when local photos exist) */}
          {canUpload && room.totalPhotos > 0 && !room.driveFolderId && (
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

          {/* Option F: Find My Photos (all members) */}
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

        {/* Upload Requests Panel (owner only) */}
        {isOwner && (
          <div className="mb-8">
            <UploadRequestsPanel roomId={roomId} />
          </div>
        )}

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

      {/* Drive Folder Picker Modal */}
      {showFolderPicker && (
        <DriveFolderPicker
          roomId={roomId}
          onSelect={(folder) => {
            setRoom((prev) => ({
              ...prev,
              driveFolderId: folder.id,
              driveFolderName: folder.name,
            }));
            setSuccessMsg(`Linked folder: ${folder.name}`);
          }}
          onClose={() => setShowFolderPicker(false)}
        />
      )}

      {/* QR Code Modal */}
      {showQRCode && (
        <QRCodeModal
          room={room}
          onClose={() => setShowQRCode(false)}
        />
      )}
    </div>
  );
};

export default Room;
