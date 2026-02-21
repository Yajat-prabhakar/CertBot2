// Change this to your Render backend URL after deployment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function submitFeedback(data) {
  try {
    const response = await fetch(`${API_URL}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to submit feedback');
    }

    return result;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}
