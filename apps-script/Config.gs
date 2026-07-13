const MV = Object.freeze({
  APP_NAME: 'Mechviz',
  VERSION: '0.1.0',
  KEY_PROPERTY: 'mechviz',
  SHEETS: {
    SETUP: 'Setup', SETTINGS: 'Settings', USERS: 'Users', SESSIONS: 'Sessions',
    PROJECTS: 'Projects', SOURCE_FILES: 'SourceFiles', RENDERS: 'Renders',
    FEEDBACK: 'Feedback', EVENTS: 'Events', API_USAGE: 'ApiUsage',
    ERRORS: 'Errors', RATE_LIMITS: 'RateLimits', PLANS: 'Plans'
  },
  DEFAULTS: {
    OPENAI_MODEL: 'gpt-image-2',
    SIZE: '1536x1024',
    QUALITY: 'medium',
    MAX_UPLOAD_MB: 10,
    MAX_SOURCE_IMAGES: 4,
    SESSION_DAYS: 30,
    FREE_RENDER_LIMIT: 3
  }
});

function getSpreadsheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Mechviz must be bound to the Mechviz Database spreadsheet.');
  return ss;
}

function getOpenAiKey_() {
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty(MV.KEY_PROPERTY) || props.getProperty('MECHVIZ');
  if (!key) throw new Error('Missing Script Property "mechviz". Add your OpenAI API key in Project Settings.');
  return key.trim();
}

function getSetting_(key, fallback) {
  const sh = getSpreadsheet_().getSheetByName(MV.SHEETS.SETTINGS);
  if (!sh || sh.getLastRow() < 2) return fallback;
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  const match = rows.find(r => String(r[0]) === String(key));
  return match && match[1] !== '' ? match[1] : fallback;
}

function setSetting_(key, value) {
  const sh = getSpreadsheet_().getSheetByName(MV.SHEETS.SETTINGS);
  const rows = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 2).getValues();
  const index = rows.findIndex(r => String(r[0]) === String(key));
  if (index >= 0) {
    sh.getRange(index + 2, 2).setValue(value);
    sh.getRange(index + 2, 5).setValue(new Date());
  } else {
    sh.appendRow([key, value, '', 'TRUE', new Date()]);
  }
}

function json_(value) {
  return JSON.stringify(value == null ? {} : value);
}

function uuid_() {
  return Utilities.getUuid();
}

function now_() {
  return new Date();
}
