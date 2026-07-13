function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Mechviz')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include_(fileName) {
  return HtmlService.createHtmlOutputFromFile(fileName).getContent();
}

function serializeForClient_(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeForClient_);
  if (typeof value === 'object') {
    const output = {};
    Object.keys(value).forEach(key => {
      if (key !== '_row') output[key] = serializeForClient_(value[key]);
    });
    return output;
  }
  return value;
}

function api(action, payload) {
  payload = payload || {};
  try {
    const routes = {
      signup: apiSignup, login: apiLogin, logout: apiLogout, me: apiMe,
      listProjects: apiListProjects, createProject: apiCreateProject,
      getProject: apiGetProject, generateRender: apiGenerateRender,
      approveRender: apiApproveRender, submitFeedback: apiSubmitFeedback,
      adminStats: apiAdminStats
    };
    if (!routes[action]) throw new Error('Unknown action.');
    return {ok: true, data: serializeForClient_(routes[action](payload))};
  } catch (error) {
    logError_(error, {route: action, publicMessage: error.message || 'Request failed.'});
    return {ok: false, error: error.message || 'Request failed.'};
  }
}

function apiAdminStats(payload) {
  const user = requireUser_(payload.token);
  if (String(user.role) !== 'admin') throw new Error('Admin access required.');
  return {
    users: rows_(MV.SHEETS.USERS).length,
    projects: rows_(MV.SHEETS.PROJECTS).length,
    renders: rows_(MV.SHEETS.RENDERS).length,
    feedback: rows_(MV.SHEETS.FEEDBACK).length,
    unresolvedErrors: findMany_(MV.SHEETS.ERRORS, r => !r.resolved).length,
    usage: rows_(MV.SHEETS.API_USAGE).slice(-100).reverse()
  };
}
