const elements = {
  loginPanel: document.getElementById('login-panel'),
  adminPanel: document.getElementById('admin-panel'),
  loginForm: document.getElementById('login-form'),
  loginMessage: document.getElementById('login-message'),
  logoutButton: document.getElementById('logout-button'),
  imageForm: document.getElementById('image-form'),
  formTitle: document.getElementById('form-title'),
  formMessage: document.getElementById('form-message'),
  saveButton: document.getElementById('save-button'),
  cancelEdit: document.getElementById('cancel-edit'),
  recordId: document.getElementById('record-id'),
  status: document.getElementById('status'),
  menuPath: document.getElementById('menu-path'),
  title: document.getElementById('title'),
  altText: document.getElementById('alt-text'),
  sort: document.getElementById('sort'),
  image: document.getElementById('image'),
  imageHelp: document.getElementById('image-help'),
  filePreview: document.getElementById('file-preview'),
  imageList: document.getElementById('image-list'),
  emptyState: document.getElementById('empty-state'),
  totalCount: document.getElementById('total-count'),
  publishedCount: document.getElementById('published-count'),
  search: document.getElementById('search'),
};

const state = {
  images: [],
  menuChoices: [],
  previewUrl: '',
};

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

function menuLabel(value) {
  return state.menuChoices.find(([path]) => path === value)?.[1] || value;
}

function populateMenus() {
  const current = elements.menuPath.value;
  elements.menuPath.replaceChildren(new Option('请选择菜单目录', ''));
  for (const [value, label] of state.menuChoices) {
    elements.menuPath.append(new Option(label, value));
  }
  elements.menuPath.value = current;
}

function button(label, className, onClick) {
  const node = document.createElement('button');
  node.type = 'button';
  node.textContent = label;
  if (className) node.className = className;
  node.addEventListener('click', onClick);
  return node;
}

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
  const path = document.createElement('div');
  path.className = 'image-card-path';
  path.textContent = menuLabel(item.menu_path);
  const badge = document.createElement('span');
  badge.className = `status-badge ${item.status}`;
  badge.textContent = statusLabel(item.status);
  const actions = document.createElement('div');
  actions.className = 'card-actions';
  actions.append(
    button('编辑', '', () => editImage(item)),
    button('删除', 'delete-button', () => deleteImage(item)),
  );
  body.append(title, path, badge, actions);
  card.append(preview, body);
  return card;
}

function renderImages() {
  const query = elements.search.value.trim().toLowerCase();
  const filtered = state.images.filter((item) =>
    !query || item.title.toLowerCase().includes(query) || menuLabel(item.menu_path).toLowerCase().includes(query)
  );
  elements.imageList.replaceChildren(...filtered.map(imageCard));
  elements.emptyState.hidden = state.images.length !== 0;
  elements.totalCount.textContent = `${state.images.length} 张图片`;
  elements.publishedCount.textContent = `${state.images.filter((item) => item.status === 'published').length} 张已发布`;
}

function clearPreview() {
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.previewUrl = '';
  elements.filePreview.hidden = true;
  elements.filePreview.removeAttribute('src');
}

function resetForm() {
  clearPreview();
  elements.imageForm.reset();
  elements.recordId.value = '';
  elements.status.value = 'published';
  elements.image.required = true;
  elements.imageHelp.textContent = 'JPG、PNG、WebP、AVIF、GIF，最大 4 MB';
  elements.formTitle.textContent = '上传新图片';
  elements.saveButton.textContent = '上传并保存';
  elements.cancelEdit.hidden = true;
  setMessage(elements.formMessage, '');
}

function editImage(item) {
  resetForm();
  elements.recordId.value = item.id;
  elements.status.value = item.status;
  elements.menuPath.value = item.menu_path;
  elements.title.value = item.title;
  elements.altText.value = item.alt_text || '';
  elements.sort.value = item.sort ?? '';
  elements.image.required = false;
  elements.imageHelp.textContent = '不选择文件就保留原图；选择新图片可替换';
  elements.filePreview.src = item.image_url;
  elements.filePreview.hidden = false;
  elements.formTitle.textContent = '编辑图片';
  elements.saveButton.textContent = '保存修改';
  elements.cancelEdit.hidden = false;
  elements.imageForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteImage(item) {
  if (!window.confirm(`确定删除“${item.title}”吗？删除后图片文件也会被移除。`)) return;
  try {
    await api(`/api/admin-images?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' });
    await loadImages();
    if (elements.recordId.value === item.id) resetForm();
  } catch (error) {
    window.alert(error.message);
    if (error.status === 401) showLogin();
  }
}

async function loadImages() {
  const payload = await api('/api/admin-images');
  state.images = payload.data || [];
  state.menuChoices = payload.menu_choices || [];
  populateMenus();
  renderImages();
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

elements.image.addEventListener('change', () => {
  clearPreview();
  const file = elements.image.files[0];
  if (!file) return;
  state.previewUrl = URL.createObjectURL(file);
  elements.filePreview.src = state.previewUrl;
  elements.filePreview.hidden = false;
});

elements.imageForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  elements.saveButton.disabled = true;
  setMessage(elements.formMessage, '正在上传和保存…');
  try {
    await api('/api/admin-images', {
      method: 'POST',
      body: new FormData(elements.imageForm),
    });
    resetForm();
    setMessage(elements.formMessage, '保存成功。前端将在约 30 秒内同步。', true);
    await loadImages();
  } catch (error) {
    setMessage(elements.formMessage, error.message);
    if (error.status === 401) showLogin();
  } finally {
    elements.saveButton.disabled = false;
  }
});

elements.cancelEdit.addEventListener('click', resetForm);
elements.search.addEventListener('input', renderImages);

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
