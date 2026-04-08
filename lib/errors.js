export class AppError extends Error {
  constructor(message, { statusCode = 500, code = 'APP_ERROR', details = {}, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class UserError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      statusCode: options.statusCode ?? 400,
      code: options.code ?? 'USER_ERROR',
      details: options.details,
      cause: options.cause,
    });
  }
}

export class ConfigError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      statusCode: options.statusCode ?? 500,
      code: options.code ?? 'CONFIG_ERROR',
      details: options.details,
      cause: options.cause,
    });
  }
}

export class ExternalError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      statusCode: options.statusCode ?? 502,
      code: options.code ?? 'EXTERNAL_ERROR',
      details: options.details,
      cause: options.cause,
    });
  }
}

export function isAppError(error) {
  return error instanceof AppError;
}
