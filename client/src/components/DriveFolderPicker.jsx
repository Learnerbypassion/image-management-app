import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import {
  HiOutlineFolder,
  HiOutlineFolderOpen,
  HiOutlineCheck,
  HiOutlineChevronRight,
  HiOutlineChevronDown,
  HiOutlineCloud,
} from 'react-icons/hi2';

const DriveFolderPicker = ({ roomId, onSelect, onClose }) => {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
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

  // Build tree structure
  const folderTree = useMemo(() => {
    const folderMap = new Map();
    folders.forEach((f) => folderMap.set(f.id, { ...f, children: [] }));

    const rootNodes = [];
    folders.forEach((f) => {
      const node = folderMap.get(f.id);
      const parentId = f.parents?.[0];
      if (parentId && folderMap.has(parentId)) {
        folderMap.get(parentId).children.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    return rootNodes;
  }, [folders]);

  const toggleExpand = (folderId, e) => {
    e.stopPropagation();
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!selectedFolderId) return;

    const folder = folders.find((f) => f.id === selectedFolderId);
    if (!folder) return;

    setSubmitting(true);
    setError('');

    try {
      if (roomId) {
        await api.post('/drive/select-folder', {
          roomId,
          folderId: folder.id,
          folderName: folder.name,
        });
      }
      onSelect(folder);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to link Google Drive folder.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderFolderItem = (node, depth = 0) => {
    const isSelected = selectedFolderId === node.id;
    const isExpanded = expandedFolders.has(node.id);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="select-none">
        <div
          onClick={() => setSelectedFolderId(node.id)}
          style={{ paddingLeft: `${depth * 18 + 12}px` }}
          className={`flex items-center justify-between py-2.5 pr-3 rounded-xl cursor-pointer transition-all ${
            isSelected
              ? 'bg-primary-600/30 border border-primary-500/60 text-white font-semibold'
              : 'bg-surface-800/40 hover:bg-surface-800/80 text-surface-200 border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {hasChildren ? (
              <button
                onClick={(e) => toggleExpand(node.id, e)}
                className="text-surface-400 hover:text-white p-0.5 rounded cursor-pointer"
              >
                {isExpanded ? (
                  <HiOutlineChevronDown className="text-sm" />
                ) : (
                  <HiOutlineChevronRight className="text-sm" />
                )}
              </button>
            ) : (
              <span className="w-4" />
            )}

            {isSelected ? (
              <HiOutlineFolderOpen className="text-primary-400 text-lg flex-shrink-0" />
            ) : (
              <HiOutlineFolder className="text-surface-400 text-lg flex-shrink-0" />
            )}

            <span className="text-sm truncate">{node.name}</span>
          </div>

          {isSelected && (
            <HiOutlineCheck className="text-primary-400 text-base flex-shrink-0 ml-2" />
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-1">
            {node.children.map((child) => renderFolderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass rounded-3xl max-w-lg w-full p-6 animate-fade-in-up border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500/20 text-primary-400 flex items-center justify-center">
              <HiOutlineCloud className="text-xl" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Select Event Folder</h3>
              <p className="text-xs text-surface-400">Google Drive folder mapping</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-surface-400 hover:text-white transition-colors cursor-pointer text-lg p-1"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="spinner mb-3" style={{ width: 36, height: 36 }} />
            <p className="text-surface-400 text-xs">Scanning Google Drive folders...</p>
          </div>
        ) : folders.length === 0 ? (
          <div className="bg-surface-800/50 rounded-2xl p-8 text-center mb-6 border border-white/5">
            <p className="text-surface-300 text-sm mb-1">No folders found in your Google Drive.</p>
            <p className="text-surface-400 text-xs">Create a folder in Google Drive and try again.</p>
          </div>
        ) : (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2 px-2 text-xs font-semibold text-primary-400 uppercase tracking-wider">
              <HiOutlineCloud className="text-sm" />
              <span>My Drive</span>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar bg-surface-900/50 p-2 rounded-2xl border border-white/5">
              {folderTree.map((node) => renderFolderItem(node, 0))}
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-surface-300 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedFolderId || submitting}
            className="btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? (
              <div className="spinner" style={{ width: 18, height: 18 }} />
            ) : (
              'Select Folder'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DriveFolderPicker;
