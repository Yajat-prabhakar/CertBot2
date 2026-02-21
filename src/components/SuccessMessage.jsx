import Confetti from 'react-confetti';
import { useState, useEffect } from 'react';

export default function SuccessMessage({ email, onReset }) {
  const [windowDimensions, setWindowDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Confetti
        width={windowDimensions.width}
        height={windowDimensions.height}
        recycle={false}
        numberOfPieces={500}
        gravity={0.3}
      />
      
      <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 max-w-2xl w-full text-center animate-fadeInUp">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Success Message */}
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Thank You for Your Feedback!
        </h2>

        <p className="text-lg text-gray-600 mb-6">
          Your certificate has been sent to:
        </p>

        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-4 mb-8">
          <p className="text-xl font-semibold text-indigo-900">{email}</p>
        </div>

        <div className="space-y-3 text-left bg-gray-50 rounded-lg p-6 mb-8">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📧</span>
            <p className="text-gray-700">
              Check your inbox (and spam folder) in the next few minutes
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">✏️</span>
            <p className="text-gray-700">
              If you notice any errors, simply reply to the email and our AI assistant will help immediately
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🎉</span>
            <p className="text-gray-700">
              Congratulations on completing the event!
            </p>
          </div>
        </div>

        {/* Reset Button */}
        <button
          onClick={onReset}
          className="text-primary hover:text-primary-dark font-semibold underline transition-colors"
        >
          Submit Another Response
        </button>
      </div>
    </div>
  );
}
