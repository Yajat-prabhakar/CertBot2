import { useEffect, useState } from 'react';
import FeedbackForm from './components/FeedbackForm';

function App() {
  const [eventName, setEventName] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    // Get event name from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const event = urlParams.get('event');

    if (!event) {
      setError('Invalid event URL. Please use the correct link provided by your event organizer.');
    } else {
      // Decode URL-encoded event name
      setEventName(decodeURIComponent(event));
    }
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 max-w-2xl w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Invalid Event Link</h2>
          <p className="text-gray-600">{error}</p>
          <p className="text-sm text-gray-500 mt-4">
            Please contact your event organizer for the correct feedback form link.
          </p>
        </div>
      </div>
    );
  }

  if (!eventName) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <FeedbackForm eventName={eventName} />;
}

export default App;
