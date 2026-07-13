function sheet_(name) {
  const sh = getSpreadsheet_().getSheetByName(name);
  if (!sh) throw new Error('Missing required sheet: ' + name);
  return sh;
}

function headers_(name) {
  const sh = sheet_(name);
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
}

function rows_(name) {
  const sh = sheet_(name);
  if (sh.getLastRow() < 2) return [];
  const headers = headers_(name);
  return sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues().map((row, i) => {
    const out = {_row: i + 2};
    headers.forEach((h, j) => out[h] = row[j]);
    return out;
  });
}

function append_(name, record) {
  const sh = sheet_(name);
  const headers = headers_(name);
  sh.appendRow(headers.map(h => Object.prototype.hasOwnProperty.call(record, h) ? record[h] : ''));
  return record;
}

function findOne_(name, predicate) {
  return rows_(name).find(predicate) || null;
}

function findMany_(name, predicate) {
  return rows_(name).filter(predicate);
}

function updateById_(name, idField, idValue, patch) {
  const sh = sheet_(name);
  const headers = headers_(name);
  const record = findOne_(name, r => String(r[idField]) === String(idValue));
  if (!record) throw new Error(name + ' record not found.');
  Object.keys(patch).forEach(key => {
    const col = headers.indexOf(key);
    if (col >= 0) sh.getRange(record._row, col + 1).setValue(patch[key]);
  });
  return Object.assign({}, record, patch);
}

function logEvent_(eventName, context) {
  const c = context || {};
  append_(MV.SHEETS.EVENTS, {
    event_id: uuid_(), user_id: c.userId || '', project_id: c.projectId || '',
    render_id: c.renderId || '', session_id: c.sessionId || '',
    event_name: eventName, event_data_json: json_(c.data || {}), created_at: now_()
  });
}

function logUsage_(data) {
  append_(MV.SHEETS.API_USAGE, {
    usage_id: uuid_(), user_id: data.userId || '', project_id: data.projectId || '',
    render_id: data.renderId || '', operation: data.operation || '', model: data.model || '',
    input_images: data.inputImages || 0, quality: data.quality || '', size: data.size || '',
    estimated_cost: data.estimatedCost || '', latency_ms: data.latencyMs || '',
    success: data.success !== false, created_at: now_()
  });
}

function logError_(error, context) {
  const c = context || {};
  append_(MV.SHEETS.ERRORS, {
    error_id: uuid_(), user_id: c.userId || '', project_id: c.projectId || '',
    render_id: c.renderId || '', route: c.route || '', code: c.code || 'UNEXPECTED',
    public_message: c.publicMessage || 'Something went wrong.',
    internal_message: String(error && error.message || error),
    stack_summary: String(error && error.stack || '').slice(0, 5000),
    resolved: false, resolved_at: '', created_at: now_()
  });
}
