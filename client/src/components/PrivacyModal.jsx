import { useState } from 'react';
import { HiShieldCheck, HiOutlineLockClosed, HiOutlineTrash, HiOutlineSparkles } from 'react-icons/hi2';

const PrivacyModal = ({ isOpen, onAccept, onCancel }) => {
  const [agreed, setAgreed] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (agreed) {
      onAccept();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="glass rounded-3xl max-w-lg w-full p-6 text-left border border-white/10 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <HiShieldCheck className="text-2xl" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Privacy & Facial Recognition Consent</h3>
            <p className="text-xs text-surface-200">Zero-Storage Temporary Face Matching</p>
          </div>
        </div>

        <div className="space-y-3 mb-6 text-sm text-surface-200 leading-relaxed">
          <div className="bg-surface-800/50 p-3.5 rounded-2xl flex items-start gap-3 border border-white/5">
            <HiOutlineLockClosed className="text-emerald-400 text-xl flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Memory-Only Processing</p>
              <p className="text-xs text-surface-300">Your selfie is converted into a 512-dimensional facial embedding directly in RAM. No selfie photo is ever saved to disk or server databases.</p>
            </div>
          </div>

          <div className="bg-surface-800/50 p-3.5 rounded-2xl flex items-start gap-3 border border-white/5">
            <HiOutlineTrash className="text-emerald-400 text-xl flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Immediate Memory Discard</p>
              <p className="text-xs text-surface-300">Once photo vector matching is completed, your selfie buffer is immediately purged from system memory.</p>
            </div>
          </div>

          <div className="bg-surface-800/50 p-3.5 rounded-2xl flex items-start gap-3 border border-white/5">
            <HiOutlineSparkles className="text-emerald-400 text-xl flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Private Gallery Access</p>
              <p className="text-xs text-surface-300">Only photos matching your facial vector will be shown in your private attendee gallery.</p>
            </div>
          </div>
        </div>

        <label className="flex items-center gap-3 p-3 rounded-xl bg-surface-800/80 border border-emerald-500/30 cursor-pointer mb-6 hover:bg-surface-800 transition-colors">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
          />
          <span className="text-xs text-white font-medium">
            I agree to temporary facial feature processing to retrieve my photos.
          </span>
        </label>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold glass text-surface-200 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!agreed}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-900/30 flex items-center gap-2"
          >
            <HiShieldCheck className="text-lg" />
            <span>Continue & Take Selfie</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyModal;
