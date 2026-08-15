import React from 'react';
import { FiLoader, FiAlertTriangle } from 'react-icons/fi';

const SafeBlockingModal = ({ isOpen, title = 'Preparing Event', message = "Adding photos into BullMQ Redis Queue. Please don't close this window." }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="glass max-w-md w-full rounded-2xl p-8 text-center border border-primary-500/30 shadow-2xl space-y-6">
        <div className="w-16 h-16 rounded-full bg-primary-500/10 border border-primary-500/30 flex items-center justify-center mx-auto">
          <FiLoader className="w-8 h-8 text-primary-400 animate-spin" />
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>
          <p className="text-sm text-surface-300 leading-relaxed">{message}</p>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-3 text-left">
          <FiAlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-200">
            Once photos are safely queued into Redis, navigation will automatically unblock so you can browse freely.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SafeBlockingModal;
