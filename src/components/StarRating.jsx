import { useState } from 'react';

export default function StarRating({ value, onChange, error }) {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div>
      <label className="label">
        How would you rate this event? <span className="text-red-500">*</span>
      </label>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="text-4xl transition-all duration-200 transform hover:scale-125 focus:outline-none"
            aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
          >
            {star <= (hoverRating || value) ? (
              <span className="text-yellow-400 drop-shadow-lg">⭐</span>
            ) : (
              <span className="text-gray-300">☆</span>
            )}
          </button>
        ))}
      </div>
      {value > 0 && (
        <p className="text-sm text-gray-600 mt-2">
          You rated: {value} star{value > 1 ? 's' : ''}
        </p>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
