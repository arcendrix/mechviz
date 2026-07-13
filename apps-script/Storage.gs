function ensureFolder_(settingKey, folderName) {
  const existing = String(getSetting_(settingKey, '') || '');
  if (existing) {
    try { return DriveApp.getFolderById(existing); } catch (e) {}
  }
  const folder = DriveApp.createFolder(folderName);
  setSetting_(settingKey, folder.getId());
  return folder;
}

function saveDataUrl_(dataUrl, folder, fileName) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid image upload.');
  const mime = match[1];
  const bytes = Utilities.base64Decode(match[2]);
  const maxBytes = Number(getSetting_('MAX_UPLOAD_MB', MV.DEFAULTS.MAX_UPLOAD_MB)) * 1024 * 1024;
  if (bytes.length > maxBytes) throw new Error('Image exceeds the upload limit.');
  const blob = Utilities.newBlob(bytes, mime, fileName);
  return folder.createFile(blob);
}

function saveSourceFile_(user, projectId, source) {
  const folder = ensureFolder_('SOURCE_FOLDER_ID', 'Mechviz Source Images');
  const safeName = String(source.fileName || 'source.png').replace(/[^a-zA-Z0-9._-]/g, '_');
  const file = saveDataUrl_(source.dataUrl, folder, projectId + '_' + safeName);
  file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
  const record = {
    source_file_id: uuid_(), project_id: projectId, user_id: user.user_id,
    drive_file_id: file.getId(), file_name: safeName, mime_type: file.getMimeType(),
    size_bytes: file.getSize(), sha256: '', created_at: now_()
  };
  append_(MV.SHEETS.SOURCE_FILES, record);
  return record;
}

function saveRender_(base64, projectId, renderId) {
  const folder = ensureFolder_('RENDER_FOLDER_ID', 'Mechviz Generated Renders');
  const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(base64), 'image/png', projectId + '_' + renderId + '.png'));
  file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
  return file;
}

function fileDataUrl_(fileId) {
  const file = DriveApp.getFileById(fileId);
  const blob = file.getBlob();
  return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
}
