const elements = {
  loginPanel: document.getElementById('login-panel'),
  adminPanel: document.getElementById('admin-panel'),
  loginForm: document.getElementById('login-form'),
  loginMessage: document.getElementById('login-message'),
  logoutButton: document.getElementById('logout-button'),
  totalCount: document.getElementById('total-count'),
  publishedCount: document.getElementById('published-count'),
  dirView: document.getElementById('dir-view'),
  dirSearch: document.getElementById('dir-search'),
  dirGroups: document.getElementById('dir-groups'),
  folderView: document.getElementById('folder-view'),
  backToDirs: document.getElementById('back-to-dirs'),
  folderTitle: document.getElementById('folder-title'),
  folderSub: document.getElementById('folder-sub'),
  tierToggle: document.getElementById('tier-toggle'),
  dropzone: document.getElementById('dropzone'),
  folderFile: document.getElementById('folder-file'),
  uploadQueue: document.getElementById('upload-queue'),
  folderImages: document.getElementById('folder-images'),
  folderEmpty: document.getElementById('folder-empty'),
};

const state = {
  images: [],
  menuChoices: [],
  currentPath: null,
  uploading: false,
};

const IMAGE_TYPES = new Set(['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `请求失败（${response.status}）`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function showLogin() {
  elements.loginPanel.hidden = false;
  elements.adminPanel.hidden = true;
  elements.logoutButton.hidden = true;
  document.getElementById('password').focus();
}

function showAdmin() {
  elements.loginPanel.hidden = true;
  elements.adminPanel.hidden = false;
  elements.logoutButton.hidden = false;
}

function setMessage(element, message, success = false) {
  element.textContent = message;
  element.classList.toggle('success', success);
}

function statusLabel(value) {
  return {
    published: '前端显示',
    draft: '草稿',
    archived: '已归档',
  }[value] || value;
}

// —— 目录派生帮手 ——
function parseChoice([value, label]) {
  const [category] = value.split('/');
  const [catPart, stylePart] = label.split(' / ');
  const styleName = (stylePart || '').split(' · ')[0].trim();
  const catLabel = (catPart || '').split(' · ')[0].trim();
  return { value, category, catLabel, styleName, label };
}

function choiceOf(path) {
  const entry = state.menuChoices.find((c) => c[0] === path);
  return entry ? parseChoice(entry) : null;
}

function dirImages(path) {
  return state.images.filter((i) => i.menu_path === path);
}

function dirThumb(path) {
  return dirImages(path)[0]?.image_url || '';
}

function dirTier(path) {
  return dirImages(path)[0]?.tier === 'free' ? 'free' : 'pro';
}

function button(label, className, onClick) {
  const node = document.createElement('button');
  node.type = 'button';
  node.textContent = label;
  if (className) node.className = className;
  node.addEventListener('click', onClick);
  return node;
}

// —— 图片卡片（详情视图内，仅保留删除） ——
function imageCard(item) {
  const card = document.createElement('article');
  card.className = 'image-card';

  const preview = document.createElement('img');
  preview.src = item.image_url;
  preview.alt = item.alt_text || item.title;
  preview.loading = 'lazy';

  const body = document.createElement('div');
  body.className = 'image-card-body';
  const title = document.createElement('div');
  title.className = 'image-card-title';
  title.textContent = item.title;
  const badge = document.createElement('span');
  badge.className = `status-badge ${item.status}`;
  badge.textContent = statusLabel(item.status);
  const actions = document.createElement('div');
  actions.className = 'card-actions';
  actions.append(button('删除', 'delete-button', () => deleteImage(item)));
  body.append(title, badge, actions);
  card.append(preview, body);
  return card;
}

// —— 视图 A: 目录网格 ——
function dirCard(info) {
  const card = document.createElement('article');
  card.className = 'dir-card';
  card.setAttribute('role', 'button');
  card.tabIndex = 0;

  const count = dirImages(info.value).length;
  const thumb = dirThumb(info.value);

  const media = document.createElement('div');
  media.className = 'dir-card-media';
  if (thumb) {
    const img = document.createElement('img');
    img.src = thumb;
    img.alt = info.styleName;
    img.loading = 'lazy';
    media.append(img);
  } else {
    media.classList.add('is-empty');
  }
  const badge = document.createElement('span');
  badge.className = 'dir-count';
  badge.textContent = `${count} 张`;
  media.append(badge);

  if (count) {
    const tier = dirTier(info.value);
    const tierBadge = document.createElement('span');
    tierBadge.className = `dir-tier ${tier}`;
    tierBadge.textContent = tier === 'free' ? 'FREE' : 'PRO';
    media.append(tierBadge);
  }

  const name = document.createElement('div');
  name.className = 'dir-card-name';
  name.textContent = info.styleName;

  card.append(media, name);
  const open = () => openFolder(info.value);
  card.addEventListener('click', open);
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  });
  return card;
}

function renderDirGroups() {
  const query = elements.dirSearch.value.trim().toLowerCase();
  const groups = new Map();
  for (const choice of state.menuChoices) {
    const info = parseChoice(choice);
    if (query && !info.styleName.toLowerCase().includes(query) && !info.catLabel.toLowerCase().includes(query)) {
      continue;
    }
    if (!groups.has(info.category)) groups.set(info.category, { label: info.catLabel, items: [] });
    groups.get(info.category).items.push(info);
  }

  const nodes = [];
  for (const { label, items } of groups.values()) {
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.className = 'dir-group-title';
    heading.textContent = label;
    const grid = document.createElement('div');
    grid.className = 'dir-grid';
    grid.append(...items.map(dirCard));
    section.append(heading, grid);
    nodes.push(section);
  }
  elements.dirGroups.replaceChildren(...nodes);
}

function updateStats() {
  elements.totalCount.textContent = `${state.images.length} 张图片`;
  elements.publishedCount.textContent = `${state.images.filter((i) => i.status === 'published').length} 张已发布`;
}

// —— 视图 B: 单目录详情 ——
function renderFolderImages() {
  const items = dirImages(state.currentPath);
  elements.folderImages.replaceChildren(...items.map(imageCard));
  elements.folderEmpty.hidden = items.length !== 0;
}

function renderTierToggle() {
  const btn = elements.tierToggle;
  if (!state.currentPath || !dirImages(state.currentPath).length) {
    btn.hidden = true;
    return;
  }
  const tier = dirTier(state.currentPath);
  btn.hidden = false;
  btn.dataset.tier = tier;
  btn.textContent = tier === 'free'
    ? '当前：FREE（点击设为 PRO）'
    : '当前：PRO（点击设为 FREE）';
}

function showDirView() {
  state.currentPath = null;
  elements.folderView.hidden = true;
  elements.dirView.hidden = false;
  elements.uploadQueue.replaceChildren();
  renderDirGroups();
}

function openFolder(path) {
  const info = choiceOf(path);
  if (!info) return;
  state.currentPath = path;
  elements.dirView.hidden = true;
  elements.folderView.hidden = false;
  elements.folderTitle.textContent = info.styleName;
  elements.folderSub.textContent = info.catLabel;
  elements.uploadQueue.replaceChildren();
  renderFolderImages();
  renderTierToggle();
}

// —— 批量拖拽上传 ——
function queueRow(name) {
  const li = document.createElement('li');
  li.className = 'upload-row';
  const dot = document.createElement('span');
  dot.className = 'upload-dot pending';
  const label = document.createElement('span');
  label.className = 'upload-name';
  label.textContent = name;
  li.append(dot, label);
  elements.uploadQueue.append(li);
  return { dot, label };
}

function extractDroppedUrls(dt) {
  if (!dt) return [];
  const urls = [];
  const push = (value) => {
    const url = String(value || '').trim();
    if (/^https?:\/\//i.test(url)) urls.push(url);
  };
  for (const line of (dt.getData('text/uri-list') || '').split(/\r?\n/)) {
    if (line && !line.startsWith('#')) push(line);
  }
  const html = dt.getData('text/html') || '';
  for (const match of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) push(match[1]);
  push(dt.getData('text/plain'));
  return [...new Set(urls)];
}

function nameFromUrl(url) {
  try {
    const last = new URL(url).pathname.split('/').filter(Boolean).pop();
    return decodeURIComponent(last || 'image');
  } catch {
    return 'image';
  }
}

async function uploadFromUrls(urls) {
  if (state.uploading || !state.currentPath) return;
  elements.dropzone.querySelector('p').textContent = '读取拖拽的图片…';
  const files = [];
  const errors = [];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      if (!IMAGE_TYPES.has(blob.type)) throw new Error('不是支持的图片类型');
      if (blob.size > MAX_IMAGE_BYTES) throw new Error('超过 4 MB');
      files.push(new File([blob], nameFromUrl(url), { type: blob.type }));
    } catch (error) {
      errors.push({ url, message: error.message });
    }
  }
  elements.dropzone.querySelector('p').textContent = '把图片拖到这里，或点击选择（可多选）';
  if (files.length) {
    await uploadFiles(files);
  } else {
    elements.uploadQueue.replaceChildren();
  }
  for (const { url, message } of errors) {
    const row = queueRow(`${url} — 无法读取（${message}，可能跨域限制，请改用下载后拖文件）`);
    row.dot.className = 'upload-dot error';
  }
}

async function uploadFiles(fileList) {
  if (state.uploading || !state.currentPath) return;
  const info = choiceOf(state.currentPath);
  if (!info) return;

  const files = [...fileList].filter((file) => {
    if (!IMAGE_TYPES.has(file.type)) return false;
    if (file.size > MAX_IMAGE_BYTES) return false;
    return true;
  });
  const rejected = fileList.length - files.length;
  if (!files.length) {
    if (rejected) window.alert('没有可上传的图片：只支持 JPG/PNG/WebP/AVIF/GIF，单张 ≤ 4 MB。');
    return;
  }

  state.uploading = true;
  elements.dropzone.classList.add('is-busy');
  elements.uploadQueue.replaceChildren();

  const title = info.styleName.toUpperCase();
  const altText = `${title} — ${info.catLabel} visual style preview`;
  let sort = Math.max(0, ...dirImages(state.currentPath).map((i) => i.sort ?? 0)) + 1;
  let done = 0;
  const total = files.length;
  if (rejected) queueRow(`（已跳过 ${rejected} 个不支持的文件）`).dot.className = 'upload-dot error';

  for (const file of files) {
    const row = queueRow(file.name);
    row.dot.className = 'upload-dot uploading';
    elements.dropzone.querySelector('p').textContent = `上传中 ${done + 1}/${total}…`;
    try {
      const fd = new FormData();
      fd.append('status', 'published');
      fd.append('menu_path', state.currentPath);
      fd.append('title', title);
      fd.append('alt_text', altText);
      fd.append('sort', String(sort++));
      fd.append('image', file);
      await api('/api/admin-images', { method: 'POST', body: fd });
      row.dot.className = 'upload-dot done';
      done += 1;
    } catch (error) {
      row.dot.className = 'upload-dot error';
      row.label.textContent = `${file.name} — ${error.message}`;
      if (error.status === 401) {
        state.uploading = false;
        elements.dropzone.classList.remove('is-busy');
        return showLogin();
      }
    }
  }

  state.uploading = false;
  elements.dropzone.classList.remove('is-busy');
  elements.dropzone.querySelector('p').textContent = '把图片拖到这里，或点击选择（可多选）';
  elements.folderFile.value = '';
  await loadImages();
}

async function deleteImage(item) {
  if (!window.confirm(`确定删除“${item.title}”吗？删除后图片文件也会被移除。`)) return;
  try {
    await api(`/api/admin-images?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' });
    await loadImages();
  } catch (error) {
    window.alert(error.message);
    if (error.status === 401) showLogin();
  }
}

async function loadImages() {
  const payload = await api('/api/admin-images');
  state.images = payload.data || [];
  state.menuChoices = payload.menu_choices || [];
  updateStats();
  if (state.currentPath) {
    renderFolderImages();
    renderTierToggle();
    renderDirGroups();
  } else {
    renderDirGroups();
  }
}

elements.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = elements.loginForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  setMessage(elements.loginMessage, '正在登录…');
  try {
    await api('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: document.getElementById('password').value }),
    });
    elements.loginForm.reset();
    setMessage(elements.loginMessage, '');
    showAdmin();
    await loadImages();
  } catch (error) {
    setMessage(elements.loginMessage, error.message);
  } finally {
    submit.disabled = false;
  }
});

elements.logoutButton.addEventListener('click', async () => {
  await api('/api/admin-logout', { method: 'POST' }).catch(() => {});
  showLogin();
});

elements.dirSearch.addEventListener('input', renderDirGroups);
elements.backToDirs.addEventListener('click', showDirView);

elements.tierToggle.addEventListener('click', async () => {
  if (!state.currentPath || state.uploading) return;
  const target = elements.tierToggle.dataset.tier === 'free' ? 'pro' : 'free';
  elements.tierToggle.disabled = true;
  try {
    await api('/api/admin-images', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_tier', menu_path: state.currentPath, tier: target }),
    });
    await loadImages();
  } catch (error) {
    window.alert(error.message);
    if (error.status === 401) showLogin();
  } finally {
    elements.tierToggle.disabled = false;
  }
});

elements.dropzone.addEventListener('click', () => {
  if (!state.uploading) elements.folderFile.click();
});
elements.dropzone.addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && !state.uploading) {
    event.preventDefault();
    elements.folderFile.click();
  }
});
elements.folderFile.addEventListener('change', () => {
  if (elements.folderFile.files.length) uploadFiles(elements.folderFile.files);
});
elements.dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  if (!state.uploading) elements.dropzone.classList.add('is-dragover');
});
elements.dropzone.addEventListener('dragleave', () => {
  elements.dropzone.classList.remove('is-dragover');
});
elements.dropzone.addEventListener('drop', async (event) => {
  event.preventDefault();
  elements.dropzone.classList.remove('is-dragover');
  if (state.uploading) return;
  const dt = event.dataTransfer;
  if (dt?.files?.length) {
    uploadFiles(dt.files);
    return;
  }
  const urls = extractDroppedUrls(dt);
  if (urls.length) uploadFromUrls(urls);
});

(async () => {
  try {
    const session = await api('/api/admin-session');
    if (!session.authenticated) return showLogin();
    showAdmin();
    await loadImages();
  } catch {
    showLogin();
  }
})();
