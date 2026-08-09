import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import SelfieCamera from '../components/SelfieCamera';
import PhotoGrid from '../components/PhotoGrid';
import api from '../services/api';
import { HiOutlineFaceSmile } from 'react-icons/hi2';

const Selfie = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [step, setStep] = useState('consent'); // consent | camera | searching | results
  const [photos, setPhotos] = useState([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');

  const handleCapture = async (blob) => {
    setStep('searching');
    setError('');

    try {
      const formData = new FormData();
      formData.append('selfie', blob, 'selfie.jpg');

      const { data } = await api.post(`/rooms/${roomId}/match`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });

      setPhotos(data.photos);
      setCount(data.count);
      setStep('results');
    } catch (err) {
      setError(err.response?.data?.error || 'Matching failed. Please try again.');
      setStep('camera');
    }
  };

  // Consent screen
  if (step === 'consent') {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="glass rounded-2xl p-8 text-center animate-fade-in-up">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center mx-auto mb-6">
            <HiOutlineFaceSmile className="text-white text-3xl" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Face Recognition</h2>
          <p className="text-surface-200 mb-6 text-sm leading-relaxed">
            This room uses face recognition to find photos containing you.
            Your selfie will be processed to generate a face embedding, which is
            compared against indexed photos. Your selfie is <strong className="text-white">not stored</strong> permanently.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => setStep('camera')}
              className="btn-primary w-full py-3.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
            >
              Continue
            </button>
            <button
              onClick={() => navigate(`/room/${roomId}`)}
              className="w-full py-3 rounded-xl text-sm text-surface-200 hover:text-white transition-colors cursor-pointer"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Camera
  if (step === 'camera') {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="animate-fade-in-up">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            Take a Selfie
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <SelfieCamera
            onCapture={handleCapture}
            onCancel={() => navigate(`/room/${roomId}`)}
          />
        </div>
      </div>
    );
  }

  // Searching
  if (step === 'searching') {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center animate-fade-in-up">
        <div className="spinner mx-auto mb-6" style={{ width: 56, height: 56 }} />
        <h2 className="text-2xl font-bold text-white mb-2">Searching...</h2>
        <p className="text-surface-200">
          Finding photos that match your face
        </p>
      </div>
    );
  }

  // Results
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="animate-fade-in-up">
        <div className="text-center mb-8">
          {count > 0 ? (
            <>
              <h2 className="text-3xl font-bold mb-2">
                🎉 <span className="gradient-text">{count} photo{count !== 1 ? 's' : ''} found</span>
              </h2>
              <p className="text-surface-200">
                Here are the photos you appear in
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-white mb-2">
                No matching photos found
              </h2>
              <p className="text-surface-200">
                Try taking another selfie with better lighting
              </p>
            </>
          )}
        </div>

        <PhotoGrid photos={photos} />

        <div className="flex justify-center gap-4 mt-8">
          <button
            onClick={() => setStep('camera')}
            className="px-6 py-3 rounded-xl text-sm font-semibold text-surface-200 glass hover:text-white transition-colors cursor-pointer"
          >
            Try Another Selfie
          </button>
          <button
            onClick={() => navigate(`/room/${roomId}`)}
            className="btn-primary px-6 py-3 rounded-xl text-sm font-semibold text-white cursor-pointer"
          >
            Back to Room
          </button>
        </div>
      </div>
    </div>
  );
};

export default Selfie;
