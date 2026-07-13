const MV = Object.freeze({
  KEY_PROPERTY: 'mechviz',
  SHEETS: {
    SETTINGS: 'Settings', USERS: 'Users', SESSIONS: 'Sessions', PROJECTS: 'Projects',
    SOURCE_FILES: 'SourceFiles', RENDERS: 'Renders', FEEDBACK: 'Feedback', EVENTS: 'Events',
    API_USAGE: 'ApiUsage', ERRORS: 'Errors', RATE_LIMITS: 'RateLimits', PLANS: 'Plans'
  },
  DEFAULTS: {
    OPENAI_MODEL: 'gpt-image-2', SIZE: '1536x1024', QUALITY: 'medium',
    MAX_UPLOAD_MB: 10, MAX_SOURCE_IMAGES: 4, FREE_RENDER_LIMIT: 3, SESSION_DAYS: 30
  }
});

function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getOpenAiKey_() {
  const properties = PropertiesService.getScriptProperties();
  const key = properties.getProperty(MV.KEY_PROPERTY) || properties.getProperty('MECHVIZ');
  if (!key) throw new Error('OpenAI key missing. Add a Script Property named "mechviz".');
  return key.trim();
}

function getSetting_(key, fallback) {
  const row = findOne_(MV.SHEETS.SETTINGS, r => String(r.setting_key) === String(key));
  return row && row.setting_value !== '' ? row.setting_value : fallback;
}

function setSetting_(key, value) {
  const sheet = getSpreadsheet_().getSheetByName(MV.SHEETS.SETTINGS);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(key)) {
      sheet.getRange(i + 1, 2).setValue(value);
      sheet.getRange(i + 1, 5).setValue(new Date());
      return;
    }
  }
  sheet.appendRow([key, value, '', 'TRUE', new Date()]);
}

function now_() { return new Date(); }
function uuid_() { return Utilities.getUuid(); }
function json_(value) { return JSON.stringify(value == null ? {} : value); }
function hash_(value) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8);
  return digest.map(b => ('0' + ((b < 0 ? b + 256 : b).toString(16))).slice(-2)).join('');
}
function safeEmail_(email) { return String(email || '').trim().toLowerCase(); }
function publicUser_(user) {
  if (!user) return null;
  return {userId: user.user_id, email: user.email, name: user.name, role: user.role, planId: user.plan_id};
}
