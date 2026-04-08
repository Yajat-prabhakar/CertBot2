export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getErrorStatus(error) {
  if (!error) {
    return null;
  }

  return (
    error.statusCode ||
    error.status ||
    error.code ||
    error.response?.status ||
    error.response?.data?.status ||
    error.cause?.statusCode ||
    null
  );
}

export function isTimeoutError(error) {
  const message = [
    error?.message,
    error?.cause?.message,
    error?.stack,
  ]
    .filter(Boolean)
    .join(' ');

  return /timeout|timed out|etimedout|deadline exceeded|socket hang up/i.test(message);
}

export function isNetworkError(error) {
  const status = getErrorStatus(error);
  const message = [
    error?.message,
    error?.cause?.message,
    error?.stack,
  ]
    .filter(Boolean)
    .join(' ');

  return /network|fetch failed|econnreset|ecconnreset|enotfound|eai_again|socket hang up|connection reset|failed to fetch/i.test(message);
}

export async function withExponentialBackoff(operation, {
  attempts = 3,
  baseDelayMs = 500,
  factor = 2,
  shouldRetry = () => false,
  onRetry,
} = {}) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      const canRetry = attempt < attempts && shouldRetry(error);

      if (!canRetry) {
        throw error;
      }

      const delayMs = baseDelayMs * (factor ** (attempt - 1));
      await onRetry?.({ attempt, delayMs, error });
      await sleep(delayMs);
    }
  }

  throw lastError;
}
