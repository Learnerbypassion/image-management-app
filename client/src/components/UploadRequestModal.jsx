import { useState } from 'react';
import { HiOutlineCamera, HiOutlinePaperAirplane } from 'react-icons/hi2';

const UploadRequestModal = ({ roomId, onSubmit, onClose }) => {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass rounded-3xl max-w-md w-full p-8 border border-white/10 shadow-2xl relative animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-surface-200 hover:text-white transition-colors cursor-pointer text-xl"
        >
          ✕
        </button>

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-5">
          <HiOutlineCamera className="text-3xl text-amber-400" />
        </div>

        <h3 className="text-xl font-bold text-white text-center mb-2">
          Request Photographer Access
        </h3>
        <p className="text-surface-200 text-sm text-center mb-6 leading-relaxed">
          You are requesting permission to upload photos to this event.
          The event organizer will review your request.
        </p>

        {/* Message input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-surface-200 mb-2">
            Message <span className="text-surface-300 font-normal">(optional)</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. I'm the official event photographer"
            maxLength={500}
            rows={3}
            className="w-full bg-surface-800/60 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-surface-400 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all text-sm"
          />
          <p className="text-xs text-surface-400 mt-1 text-right">
            {message.length}/500
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-surface-200 hover:bg-surface-800/50 transition-colors cursor-pointer font-medium text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold hover:from-amber-600 hover:to-orange-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
          >
            {submitting ? (
              <div className="spinner" style={{ width: 18, height: 18 }} />
            ) : (
              <>
                <HiOutlinePaperAirplane className="text-base" />
                Send Request
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadRequestModal;
