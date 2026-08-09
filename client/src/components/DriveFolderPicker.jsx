import { useState, useEffect } from 'react';
import api from '../services/api';
import { HiOutlineFolder, HiOutlineCheck } from 'react-icons/hi2';

const DriveFolderPicker = ({ roomId, onSelect, onClose }) => {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await api.get('/drive/folders');
      setFolders(data.folders || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load Google Drive folders.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedFolderId) return;

    const folder = folders.find((f) => f.id === selectedFolderId);
    setSubmitting(true);
    setError('');

    try {
      await api.post('/drive/select-folder', {
        roomId,
        folderId: folder.id,
        folderName: folder.name,
      });
      onSelect(folder);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to link Google Drive folder.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="glass rounded-2xl max-w-lg w-full p-6 animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HiOutlineFolder className="text-primary-400 text-2xl" />
            <h3 className="text-xl font-bold text-white">Select Google Drive Folder</h3>
          </div>
          <button
            onClick={onClose}
            className="text-surface-200 hover:text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <p className="text-surface-200 text-sm mb-6">
          Choose the folder containing your event photos. SnapFind will scan the images inside this folder without downloading them to your server.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner" style={{ width: 36, height: 36 }} />
          </div>
        ) : folders.length === 0 ? (
          <div className="bg-surface-800/50 rounded-xl p-8 text-center mb-6">
            <p className="text-surface-200">No folders found in your Google Drive.</p>
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto space-y-2 mb-6 pr-1">
            {folders.map((folder) => {
              const isSelected = selectedFolderId === folder.id;
              return (
                <div
                  key={folder.id}
                  onClick={() => setSelectedFolderId(folder.id)}
                  className={`flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-primary-600/30 border border-primary-500/60 text-white'
                      : 'bg-surface-800/50 border border-transparent hover:bg-surface-800 text-surface-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <HiOutlineFolder className={isSelected ? 'text-primary-400 text-xl' : 'text-surface-200 text-xl'} />
                    <span className="font-medium truncate">{folder.name}</span>
                  </div>
                  {isSelected && <HiOutlineCheck className="text-primary-400 text-lg flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-surface-200 glass hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedFolderId || submitting}
            className="btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? <div className="spinner" style={{ width: 18, height: 18 }} /> : 'Link Folder'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DriveFolderPicker;
