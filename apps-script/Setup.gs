function onOpen() {
  SpreadsheetApp.getUi().createMenu('Mechviz')
    .addItem('Run setup', 'setupMechviz')
    .addItem('Verify configuration', 'verifyMechviz')
    .addItem('Open app preview', 'showAppPreview')
    .addToUi();
}

function setupMechviz() {
  const ss = getSpreadsheet_();
  const required = Object.keys(MV.SHEETS).map(k => MV.SHEETS[k]);
  const missing = required.filter(name => !ss.getSheetByName(name));
  if (missing.length) throw new Error('Database is missing sheets: ' + missing.join(', '));
  ensureFolder_('SOURCE_FOLDER_ID', 'Mechviz Source Images');
  ensureFolder_('RENDER_FOLDER_ID', 'Mechviz Generated Renders');
  setSetting_('APP_NAME', MV.APP_NAME);
  setSetting_('APP_VERSION', MV.VERSION);
  setSetting_('OPENAI_KEY_PROPERTY', MV.KEY_PROPERTY);
  setSetting_('OPENAI_MODEL', 'gpt-image-2');
  setSetting_('DEFAULT_SIZE', '1536x1024');
  setSetting_('DEFAULT_QUALITY', 'medium');
  setSetting_('MAX_UPLOAD_MB', 10);
  setSetting_('MAX_SOURCE_IMAGES', 4);
  setSetting_('SESSION_DAYS', 30);
  setSetting_('ADMIN_EMAIL', Session.getActiveUser().getEmail() || '');
  const setup = ss.getSheetByName(MV.SHEETS.SETUP);
  setup.getRange('B3').setValue('SETUP COMPLETE');
  SpreadsheetApp.getUi().alert('Mechviz setup complete. Add the Script Property "mechviz", then deploy as a Web App.');
  return verifyMechviz();
}

function verifyMechviz() {
  const result = {
    spreadsheetId: getSpreadsheet_().getId(),
    keyConfigured: Boolean(PropertiesService.getScriptProperties().getProperty('mechviz') || PropertiesService.getScriptProperties().getProperty('MECHVIZ')),
    sourceFolderId: getSetting_('SOURCE_FOLDER_ID', ''),
    renderFolderId: getSetting_('RENDER_FOLDER_ID', ''),
    model: getSetting_('OPENAI_MODEL', MV.DEFAULTS.OPENAI_MODEL),
    ready: false
  };
  result.ready = Boolean(result.keyConfigured && result.sourceFolderId && result.renderFolderId);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function showAppPreview() {
  const html = HtmlService.createHtmlOutputFromFile('Index').setWidth(1200).setHeight(800);
  SpreadsheetApp.getUi().showModalDialog(html, 'Mechviz');
}
