function buildPrompt_(project, instruction, isRevision) {
  const styleMap = {
    clean_cad: 'clean CAD-style concept rendering with neutral grey materials, crisp edges and a white studio background',
    technical: 'professional technical illustration with precise visual hierarchy and restrained shading',
    photorealistic: 'photorealistic industrial product visualization with realistic material response and controlled studio lighting',
    exploded: 'clear exploded-view concept showing only components supported by the source image',
    cutaway: 'careful cutaway concept without inventing unknown internal parts',
    white_background: 'premium mechanical product render on pure white with a soft contact shadow'
  };
  return [
    'Create a professional 3D concept render of the mechanical object shown in the reference image.',
    'Preserve the fundamental geometry, proportions, visible holes, slots, bends, fasteners and component relationships.',
    'Do not add decorative parts, mechanisms, labels, text, dimensions or features not supported by the source.',
    'Keep the entire object visible and centered. This is a visualization, not certified CAD.',
    'Project: ' + project.project_name + '.',
    project.description ? 'User description: ' + project.description + '.' : '',
    'Requested style: ' + (styleMap[project.render_style] || styleMap.clean_cad) + '.',
    project.viewpoint ? 'Viewpoint: ' + project.viewpoint + '.' : '',
    project.material ? 'Material appearance: ' + project.material + '.' : '',
    project.background ? 'Background: ' + project.background + '.' : '',
    isRevision ? 'Revision request: change only what follows and preserve everything else: ' + instruction : (instruction ? 'Additional instruction: ' + instruction : '')
  ].filter(Boolean).join('\n');
}

function openAiGenerate_(prompt, sourceDataUrl, settings) {
  const started = Date.now();
  const model = String(getSetting_('OPENAI_MODEL', MV.DEFAULTS.OPENAI_MODEL));
  const match = String(sourceDataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('The source image could not be prepared for OpenAI.');
  const imageBlob = Utilities.newBlob(Utilities.base64Decode(match[2]), match[1], 'mechviz-reference.png');
  const payload = {
    model: model,
    prompt: prompt,
    image: imageBlob,
    size: settings.size,
    quality: settings.quality,
    output_format: 'png'
  };
  const response = UrlFetchApp.fetch('https://api.openai.com/v1/images/edits', {
    method: 'post',
    headers: {Authorization: 'Bearer ' + getOpenAiKey_()},
    payload: payload,
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  const body = JSON.parse(response.getContentText() || '{}');
  if (status < 200 || status >= 300) {
    const message = body && body.error && body.error.message ? body.error.message : 'OpenAI image request failed.';
    throw new Error(message);
  }
  const base64 = body.data && body.data[0] && body.data[0].b64_json;
  if (!base64) throw new Error('OpenAI returned no image.');
  return {base64: base64, model: model, latencyMs: Date.now() - started, usage: body.usage || {}};
}
