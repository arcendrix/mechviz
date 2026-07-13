function hash_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}

function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function createPassword_(password) {
  if (String(password).length < 8) throw new Error('Password must be at least 8 characters.');
  const salt = uuid_().replace(/-/g, '');
  return {salt: salt, hash: hash_(salt + ':' + password)};
}

function verifyPassword_(password, salt, expected) {
  return hash_(String(salt) + ':' + String(password)) === String(expected);
}

function createSession_(userId) {
  const token = uuid_() + uuid_();
  const days = Number(getSetting_('SESSION_DAYS', MV.DEFAULTS.SESSION_DAYS));
  append_(MV.SHEETS.SESSIONS, {
    session_id: uuid_(), user_id: userId, token_hash: hash_(token), created_at: now_(),
    expires_at: new Date(Date.now() + days * 86400000), last_seen_at: now_(),
    ip_hash: '', user_agent_hash: '', revoked_at: ''
  });
  return token;
}

function requireUser_(token) {
  if (!token) throw new Error('Please sign in.');
  const session = findOne_(MV.SHEETS.SESSIONS, r => !r.revoked_at && r.token_hash === hash_(token));
  if (!session || new Date(session.expires_at).getTime() <= Date.now()) throw new Error('Your session has expired.');
  const user = findOne_(MV.SHEETS.USERS, r => String(r.user_id) === String(session.user_id));
  if (!user || String(user.status) !== 'active') throw new Error('Account is unavailable.');
  updateById_(MV.SHEETS.SESSIONS, 'session_id', session.session_id, {last_seen_at: now_()});
  return user;
}

function apiSignup(payload) {
  const email = normalizeEmail_(payload.email);
  const name = String(payload.name || '').trim();
  if (!email || !name) throw new Error('Name and email are required.');
  if (findOne_(MV.SHEETS.USERS, r => normalizeEmail_(r.email) === email)) throw new Error('An account already exists for this email.');
  const pw = createPassword_(payload.password);
  const user = {
    user_id: uuid_(), email: email, name: name, password_hash: pw.hash, salt: pw.salt,
    role: rows_(MV.SHEETS.USERS).length === 0 ? 'admin' : 'user', plan_id: 'free',
    status: 'active', created_at: now_(), updated_at: now_(), last_login_at: now_(),
    render_count: 0, marketing_consent: Boolean(payload.marketingConsent)
  };
  append_(MV.SHEETS.USERS, user);
  const token = createSession_(user.user_id);
  logEvent_('user_signed_up', {userId: user.user_id});
  return {token: token, user: publicUser_(user)};
}

function apiLogin(payload) {
  const email = normalizeEmail_(payload.email);
  const user = findOne_(MV.SHEETS.USERS, r => normalizeEmail_(r.email) === email);
  if (!user || !verifyPassword_(payload.password, user.salt, user.password_hash)) throw new Error('Incorrect email or password.');
  updateById_(MV.SHEETS.USERS, 'user_id', user.user_id, {last_login_at: now_(), updated_at: now_()});
  const token = createSession_(user.user_id);
  logEvent_('user_logged_in', {userId: user.user_id});
  return {token: token, user: publicUser_(user)};
}

function apiLogout(payload) {
  if (!payload.token) return {ok: true};
  const session = findOne_(MV.SHEETS.SESSIONS, r => r.token_hash === hash_(payload.token));
  if (session) updateById_(MV.SHEETS.SESSIONS, 'session_id', session.session_id, {revoked_at: now_()});
  return {ok: true};
}

function apiMe(payload) {
  return {user: publicUser_(requireUser_(payload.token))};
}

function publicUser_(user) {
  return {userId: user.user_id, email: user.email, name: user.name, role: user.role, planId: user.plan_id};
}
