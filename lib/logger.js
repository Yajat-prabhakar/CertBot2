export function serializeError(error) {
  if (!error) {
    return null;
  }

  return {
    name: error.name,
    message: error.message,
    code: error.code,
    statusCode: error.statusCode,
    cause: error.cause?.message,
  };
}

function writeLog(level, component, action, details = {}, requestId) {
  const payload = {
    timestamp: new Date().toISOString(),
    requestId,
    level,
    component,
    action,
    details,
  };

  if (level === 'ERROR') {
    console.error(JSON.stringify(payload));
    return;
  }

  if (level === 'WARN') {
    console.warn(JSON.stringify(payload));
    return;
  }

  console.log(JSON.stringify(payload));
}

export function logInfo(component, action, details = {}, requestId) {
  writeLog('INFO', component, action, details, requestId);
}

export function logWarn(component, action, details = {}, requestId) {
  writeLog('WARN', component, action, details, requestId);
}

export function logError(component, action, details = {}, requestId) {
  writeLog('ERROR', component, action, details, requestId);
}
