function apiListProjects(payload) {
  const user = requireUser_(payload.token);
  const projects = findMany_(MV.SHEETS.PROJECTS, r => String(r.user_id) === String(user.user_id) && !r.archived_at)
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  return {projects: projects.map(p => ({
    projectId: p.project_id, name: p.project_name, description: p.description,
    status: p.status, renderStyle: p.render_style, approvedRenderId: p.approved_render_id,
    createdAt: p.created_at, updatedAt: p.updated_at
  }))};
}

function apiCreateProject(payload) {
  const user = requireUser_(payload.token);
  const p = payload.project || {};
  if (!String(p.name || '').trim()) throw new Error('Project name is required.');
  if (!p.source || !p.source.dataUrl) throw new Error('Upload a source image.');
  const projectId = uuid_();
  const source = saveSourceFile_(user, projectId, p.source);
  const record = {
    project_id: projectId, user_id: user.user_id, project_name: String(p.name).trim(),
    description: String(p.description || '').trim(), status: 'ready',
    render_style: p.renderStyle || 'clean_cad', viewpoint: p.viewpoint || 'isometric',
    material: p.material || 'machined aluminum', background: p.background || 'white studio',
    canonical_prompt: '', approved_render_id: '', source_file_id: source.source_file_id,
    created_at: now_(), updated_at: now_(), archived_at: ''
  };
  append_(MV.SHEETS.PROJECTS, record);
  logEvent_('project_created', {userId: user.user_id, projectId: projectId});
  return {project: record};
}

function getOwnedProject_(user, projectId) {
  const p = findOne_(MV.SHEETS.PROJECTS, r => String(r.project_id) === String(projectId));
  if (!p || (String(p.user_id) !== String(user.user_id) && String(user.role) !== 'admin')) throw new Error('Project not found.');
  return p;
}

function apiGetProject(payload) {
  const user = requireUser_(payload.token);
  const project = getOwnedProject_(user, payload.projectId);
  const source = findOne_(MV.SHEETS.SOURCE_FILES, r => String(r.source_file_id) === String(project.source_file_id));
  const renders = findMany_(MV.SHEETS.RENDERS, r => String(r.project_id) === String(project.project_id))
    .sort((a, b) => Number(a.revision_number) - Number(b.revision_number));
  return {project: project, sourceDataUrl: source ? fileDataUrl_(source.drive_file_id) : '', renders: renders.map(renderPublic_)};
}

function checkRenderLimit_(user) {
  const plan = findOne_(MV.SHEETS.PLANS, r => String(r.plan_id) === String(user.plan_id || 'free'));
  const limit = Number(plan && plan.renders_per_month || MV.DEFAULTS.FREE_RENDER_LIMIT);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const count = findMany_(MV.SHEETS.RENDERS, r => String(r.user_id) === String(user.user_id) && new Date(r.created_at) >= monthStart).length;
  if (count >= limit) throw new Error('You have reached this month\'s render limit.');
}

function apiGenerateRender(payload) {
  const user = requireUser_(payload.token);
  checkRenderLimit_(user);
  const project = getOwnedProject_(user, payload.projectId);
  const source = findOne_(MV.SHEETS.SOURCE_FILES, r => String(r.source_file_id) === String(project.source_file_id));
  if (!source) throw new Error('Project source image is missing.');
  const existing = findMany_(MV.SHEETS.RENDERS, r => String(r.project_id) === String(project.project_id));
  const parent = payload.parentRenderId ? existing.find(r => String(r.render_id) === String(payload.parentRenderId)) : null;
  const sourceDataUrl = parent && parent.output_drive_file_id ? fileDataUrl_(parent.output_drive_file_id) : fileDataUrl_(source.drive_file_id);
  const instruction = String(payload.instruction || '').trim();
  const prompt = buildPrompt_(project, instruction, Boolean(parent));
  const size = String(getSetting_('DEFAULT_SIZE', MV.DEFAULTS.SIZE));
  const quality = String(getSetting_('DEFAULT_QUALITY', MV.DEFAULTS.QUALITY));
  const renderId = uuid_();
  try {
    const result = openAiGenerate_(prompt, sourceDataUrl, {size: size, quality: quality});
    const file = saveRender_(result.base64, project.project_id, renderId);
    const record = {
      render_id: renderId, project_id: project.project_id, user_id: user.user_id,
      parent_render_id: parent ? parent.render_id : '', revision_number: existing.length + 1,
      status: 'complete', openai_response_id: '', openai_model: result.model,
      instruction: instruction, prompt: prompt, output_drive_file_id: file.getId(),
      output_mime_type: 'image/png', width: size.split('x')[0], height: size.split('x')[1],
      quality: quality, estimated_cost: '', latency_ms: result.latencyMs,
      approved: false, created_at: now_(), approved_at: '', error_message: ''
    };
    append_(MV.SHEETS.RENDERS, record);
    updateById_(MV.SHEETS.PROJECTS, 'project_id', project.project_id, {status: 'rendered', updated_at: now_(), canonical_prompt: prompt});
    logUsage_({userId: user.user_id, projectId: project.project_id, renderId: renderId, operation: parent ? 'revision' : 'generation', model: result.model, inputImages: 1, quality: quality, size: size, latencyMs: result.latencyMs, success: true});
    logEvent_(parent ? 'render_revised' : 'render_generated', {userId: user.user_id, projectId: project.project_id, renderId: renderId});
    return {render: renderPublic_(record, 'data:image/png;base64,' + result.base64)};
  } catch (error) {
    logUsage_({userId: user.user_id, projectId: project.project_id, renderId: renderId, operation: parent ? 'revision' : 'generation', model: getSetting_('OPENAI_MODEL', MV.DEFAULTS.OPENAI_MODEL), inputImages: 1, quality: quality, size: size, success: false});
    logError_(error, {userId: user.user_id, projectId: project.project_id, renderId: renderId, route: 'generateRender', publicMessage: 'The render could not be generated.'});
    throw error;
  }
}

function apiApproveRender(payload) {
  const user = requireUser_(payload.token);
  const project = getOwnedProject_(user, payload.projectId);
  const render = findOne_(MV.SHEETS.RENDERS, r => String(r.render_id) === String(payload.renderId) && String(r.project_id) === String(project.project_id));
  if (!render) throw new Error('Render not found.');
  updateById_(MV.SHEETS.RENDERS, 'render_id', render.render_id, {approved: true, approved_at: now_()});
  updateById_(MV.SHEETS.PROJECTS, 'project_id', project.project_id, {approved_render_id: render.render_id, status: 'approved', updated_at: now_()});
  logEvent_('render_approved', {userId: user.user_id, projectId: project.project_id, renderId: render.render_id});
  return {ok: true};
}

function apiSubmitFeedback(payload) {
  const user = requireUser_(payload.token);
  getOwnedProject_(user, payload.projectId);
  append_(MV.SHEETS.FEEDBACK, {
    feedback_id: uuid_(), project_id: payload.projectId, render_id: payload.renderId || '',
    user_id: user.user_id, rating: Number(payload.rating || 0),
    accuracy_rating: Number(payload.accuracyRating || 0), usefulness_rating: Number(payload.usefulnessRating || 0),
    comments: String(payload.comments || ''), created_at: now_()
  });
  return {ok: true};
}

function renderPublic_(r, dataUrl) {
  return {
    renderId: r.render_id, projectId: r.project_id, parentRenderId: r.parent_render_id,
    revisionNumber: r.revision_number, status: r.status, instruction: r.instruction,
    approved: r.approved === true || String(r.approved).toLowerCase() === 'true',
    createdAt: r.created_at,
    dataUrl: dataUrl || (r.output_drive_file_id ? fileDataUrl_(r.output_drive_file_id) : '')
  };
}
