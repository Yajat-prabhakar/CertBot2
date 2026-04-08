const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export class ApiError extends Error {
  constructor(message, { statusCode, code, requestId, type = 'unknown', cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.requestId = requestId;
    this.type = type;
  }
}

export async function submitFeedback(data) {
  try {
    const response = await fetch(`${API_URL}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    let result = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok) {
      throw new ApiError(
        result?.message || result?.error || 'Failed to submit feedback',
        {
          statusCode: response.status,
          code: result?.error,
          requestId: result?.requestId,
          type: response.status >= 500 ? 'server' : 'validation',
        }
      );
    }

    return result;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof TypeError) {
      throw new ApiError('Unable to reach the server. Check your connection and try again.', {
        type: 'network',
        cause: error,
      });
    }

    throw new ApiError(error.message || 'Failed to submit feedback', {
      type: 'unknown',
      cause: error,
    });
  }
}
