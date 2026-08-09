import { useState, useRef, useCallback, useEffect } from 'react';
import { HiOutlineCamera } from 'react-icons/hi';

const SelfieCamera = ({ onCapture, onCancel }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [isCaptured, setIsCaptured] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setError('Camera access denied. Please allow camera permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    // Mirror the image (selfie mode)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        setCapturedImage(URL.createObjectURL(blob));
        setIsCaptured(true);
        stopCamera();
        onCapture(blob);
      },
      'image/jpeg',
      0.9
    );
  }, [stream, onCapture]);

  const retake = () => {
    setIsCaptured(false);
    setCapturedImage(null);
    startCamera();
  };

  if (error) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <p className="text-error-500 mb-4">{error}</p>
        <button
          onClick={startCamera}
          className="btn-primary px-6 py-2 rounded-xl text-sm font-semibold text-white cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6">
      <div className="relative aspect-[4/3] max-w-lg mx-auto overflow-hidden rounded-xl bg-surface-900">
        {!isCaptured ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
            {/* Face guide overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-60 border-2 border-primary-400/60 rounded-[50%] shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
            </div>
            <p className="absolute bottom-4 left-0 right-0 text-center text-sm text-white/80">
              Position your face inside the oval
            </p>
          </>
        ) : (
          <img
            src={capturedImage}
            alt="Captured selfie"
            className="w-full h-full object-cover"
          />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="flex gap-3 mt-6 justify-center">
        {!isCaptured ? (
          <>
            <button
              onClick={onCancel}
              className="px-6 py-3 rounded-xl text-sm font-semibold text-surface-200 glass hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={capture}
              className="btn-primary px-8 py-3 rounded-xl text-sm font-semibold text-white flex items-center gap-2 cursor-pointer"
            >
              <HiOutlineCamera className="text-lg" />
              Capture
            </button>
          </>
        ) : (
          <button
            onClick={retake}
            className="px-6 py-3 rounded-xl text-sm font-semibold text-surface-200 glass hover:text-white transition-colors cursor-pointer"
          >
            Retake
          </button>
        )}
      </div>
    </div>
  );
};

export default SelfieCamera;
