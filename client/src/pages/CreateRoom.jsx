import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import api from '../services/api';
import DriveFolderPicker from '../components/DriveFolderPicker';
import {
  HiOutlinePlus,
  HiOutlineCloud,
  HiOutlineFolder,
  HiOutlineCheckCircle,
  HiOutlineServer,
} from 'react-icons/hi2';

const CreateRoom = () => {
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [description, setDescription] = useState('');
  const [storageProvider, setStorageProvider] = useState('google-drive');
  const [driveFolder, setDriveFolder] = useState(null);

  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    checkDriveStatus();
  }, []);

  const checkDriveStatus = async () => {
    try {
      const { data } = await api.get('/drive/status');
      setIsDriveConnected(data.isConnected);
    } catch {
      setIsDriveConnected(false);
    }
  };

  const handleConnectDrive = async () => {
    try {
      const { data } = await api.get('/drive/connect');
      window.location.href = data.url;
    } catch (err) {
      setError('Failed to initiate Google Drive authentication.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/rooms', {
        name,
        organization,
        description,
        storageProvider,
        driveFolderId: driveFolder?.id || null,
        driveFolderName: driveFolder?.name || null,
      });
      navigate(`/room/${data.room._id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold text-white mb-2">Create an Event Room</h1>
        <p className="text-surface-200 mb-8">
          Set up an event room, choose storage backend, and link your photo directory.
        </p>

        <div className="glass rounded-3xl p-8 border border-white/10 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Event Name */}
            <div>
              <label className="block text-sm font-medium text-surface-200 mb-2">
                Event Name <span className="text-accent-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Freshers 2026"
                required
                className="input-field w-full px-4 py-3 rounded-xl text-white placeholder-surface-600 focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Organization */}
            <div>
              <label className="block text-sm font-medium text-surface-200 mb-2">
                Organization / College
              </label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="e.g., GNIT"
                className="input-field w-full px-4 py-3 rounded-xl text-white placeholder-surface-600 focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-surface-200 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Freshers Party photos & memories"
                rows={3}
                className="input-field w-full px-4 py-3 rounded-xl text-white placeholder-surface-600 resize-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Storage Selection */}
            <div>
              <label className="block text-sm font-semibold text-white mb-3">
                Storage Provider
              </label>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Local option */}
                <div
                  onClick={() => setStorageProvider('local')}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                    storageProvider === 'local'
                      ? 'bg-primary-600/20 border-primary-500 text-white'
                      : 'bg-surface-800/40 border-white/5 hover:border-white/20 text-surface-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="storageProvider"
                    checked={storageProvider === 'local'}
                    onChange={() => setStorageProvider('local')}
                    className="accent-primary-500"
                  />
                  <HiOutlineServer className="text-xl text-primary-400" />
                  <div>
                    <p className="font-semibold text-sm">Local Storage</p>
                    <p className="text-xs text-surface-400">Direct disk uploads</p>
                  </div>
                </div>

                {/* Google Drive option */}
                <div
                  onClick={() => setStorageProvider('google-drive')}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                    storageProvider === 'google-drive'
                      ? 'bg-primary-600/20 border-primary-500 text-white'
                      : 'bg-surface-800/40 border-white/5 hover:border-white/20 text-surface-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="storageProvider"
                    checked={storageProvider === 'google-drive'}
                    onChange={() => setStorageProvider('google-drive')}
                    className="accent-primary-500"
                  />
                  <HiOutlineCloud className="text-xl text-emerald-400" />
                  <div>
                    <p className="font-semibold text-sm">Google Drive</p>
                    <p className="text-xs text-surface-400">Drive folder stream</p>
                  </div>
                </div>
              </div>

              {/* Google Drive Connection Block */}
              {storageProvider === 'google-drive' && (
                <div className="bg-surface-900/60 border border-white/10 rounded-2xl p-4 space-y-3">
                  {!isDriveConnected ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-semibold">Connect Google Drive</p>
                        <p className="text-surface-400 text-xs">Authorize SnapFind to browse Drive folders</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleConnectDrive}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all cursor-pointer shadow-md"
                      >
                        Connect Google Drive
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-green-400 text-sm font-semibold">
                          <HiOutlineCheckCircle className="text-lg" />
                          <span>Google Drive connected</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowFolderPicker(true)}
                          className="px-3.5 py-1.5 rounded-xl bg-primary-600/30 border border-primary-500/40 text-primary-300 hover:bg-primary-600/40 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <HiOutlineFolder className="text-sm" />
                          {driveFolder ? 'Change Folder' : 'Select event folder'}
                        </button>
                      </div>

                      {driveFolder ? (
                        <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl px-3.5 py-2 flex items-center gap-2 text-xs text-primary-300">
                          <HiOutlineFolder className="text-base text-primary-400" />
                          <span>Selected Folder: <strong>{driveFolder.name}</strong></span>
                        </div>
                      ) : (
                        <p className="text-surface-400 text-xs italic">
                          No folder selected yet. You can select a folder now or inside the room.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-4 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-primary-900/40"
            >
              {loading ? (
                <div className="spinner" style={{ width: 20, height: 20 }} />
              ) : (
                <>
                  <HiOutlinePlus className="text-lg" />
                  Create Event Room
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Drive Folder Picker Modal */}
      {showFolderPicker && (
        <DriveFolderPicker
          onSelect={(folder) => {
            setDriveFolder(folder);
            setShowFolderPicker(false);
          }}
          onClose={() => setShowFolderPicker(false)}
        />
      )}
    </div>
  );
};

export default CreateRoom;
