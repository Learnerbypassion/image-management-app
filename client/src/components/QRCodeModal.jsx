import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { HiOutlineQrCode, HiOutlineClipboardDocument, HiOutlineCheck, HiOutlineArrowDownTray } from 'react-icons/hi2';

const QRCodeModal = ({ room, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!room) return null;

  const publicToken = room.publicToken || room.code;
  const joinUrl = `${window.location.origin}/join/${publicToken}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    const svgElement = document.getElementById('room-qr-code');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 40;
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 20, 20);
      }
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `${room.name}_QR.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass rounded-3xl max-w-md w-full p-6 text-center border border-white/10 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-surface-200 hover:text-white transition-colors cursor-pointer text-xl"
        >
          ✕
        </button>

        <div className="w-12 h-12 rounded-2xl bg-primary-500/20 text-primary-400 flex items-center justify-center mx-auto mb-4">
          <HiOutlineQrCode className="text-2xl" />
        </div>

        <h3 className="text-2xl font-bold text-white mb-1">{room.name}</h3>
        <p className="text-surface-200 text-sm mb-6">Scan to join event & find your photos</p>

        {/* QR Code Container */}
        <div className="bg-white p-6 rounded-2xl inline-block mb-6 shadow-inner border border-surface-200">
          <QRCodeSVG
            id="room-qr-code"
            value={joinUrl}
            size={200}
            bgColor="#ffffff"
            fgColor="#0f172a"
            level="H"
            includeMargin={false}
          />
        </div>

        <div className="bg-surface-800/60 rounded-xl p-3 mb-6 text-left border border-white/5">
          <span className="text-xs text-surface-400 block font-medium uppercase tracking-wider mb-1">Public Join Code</span>
          <span className="font-mono text-primary-400 font-bold text-lg">{publicToken}</span>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={handleCopy}
            className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold glass text-surface-200 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <HiOutlineCheck className="text-green-400 text-lg" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <HiOutlineClipboardDocument className="text-lg" />
                <span>Copy Link</span>
              </>
            )}
          </button>
          <button
            onClick={handleDownloadQR}
            className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold btn-primary text-white cursor-pointer flex items-center justify-center gap-2"
          >
            <HiOutlineArrowDownTray className="text-lg" />
            <span>Save QR</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;
