import { api } from '../api.js';
import { mountComposer } from '../composer/index.js';

const PRODUCT_LABELS = {
  'intro-to-creative-ai':    'T2',
  'creative-ai-workshop-t3': 'T3',
  'beyond-lighting':         'BL',
  'prompt-pack':             'PP',
};

// Bunny library IDs per course (filled in during smoke-test — placeholders here).
const BUNNY_LIB = {
  'intro-to-creative-ai':    '637491',   // T2 Bunny library
  'beyond-lighting':         '637492',   // BL Bunny library (verify in staging)
};

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export default async function mount(root) {
  root.innerHTML = '<div class="lessons-page" dir="ltr"><div class="lessons-tabs">Loading…</div><div class="lessons-body"><div class="lessons-list"></div><div class="lessons-editor empty">Select a lesson on the left</div></div></div>';

  const state = {
    courses: [],
    activeCourse: null,
    lessons: [],
    collapsedModules: new Set(),
    selectedLessonId: null,
    selectedLesson: null,
    selectedContent: null,
    composer: null,
    draftMedia: {},
    draftBlocks: null,
  };

  function loadCollapsedState(courseId) {
    try {
      const raw = localStorage.getItem('lessons.collapsed.' + courseId);
      if (raw) state.collapsedModules = new Set(JSON.parse(raw));
      else state.collapsedModules = new Set();
    } catch { state.collapsedModules = new Set(); }
  }
  function saveCollapsedState() {
    try { localStorage.setItem('lessons.collapsed.' + state.activeCourse, JSON.stringify([...state.collapsedModules])); } catch {}
  }

  async function loadCourses() {
    const { courses } = await api('/api/data/lessons/courses');
    state.courses = courses;
    if (!state.activeCourse && courses.length > 0) state.activeCourse = courses[0].id;
    loadCollapsedState(state.activeCourse);
  }
  async function loadLessons() {
    if (!state.activeCourse) { state.lessons = []; return; }
    const { lessons } = await api('/api/data/lessons?course=' + encodeURIComponent(state.activeCourse));
    state.lessons = lessons || [];
  }
  async function loadLessonContent(lessonId) {
    if (!lessonId) { state.selectedContent = null; return; }
    const res = await api('/api/data/lessons/' + encodeURIComponent(lessonId) + '/content');
    state.selectedContent = res;
  }

  function selectLesson(id) {
    const lesson = state.lessons.find(l => l.id === id);
    if (!lesson) return;
    state.selectedLessonId = id;
    state.selectedLesson = lesson;
    state.draftMedia = { videoId: lesson.video_id, pdfUrl: lesson.pdf_url, active: lesson.active };
    state.draftBlocks = null;
    loadLessonContent(id).then(renderEditor);
    renderList();
  }

  function groupByModule(lessons) {
    const groups = new Map();
    for (const l of lessons) {
      const key = l.module || '—';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(l);
    }
    for (const arr of groups.values()) arr.sort((a, b) => a.lesson_order - b.lesson_order);
    return Array.from(groups.entries()).sort((a, b) => {
      const am = Math.min(...a[1].map(l => l.module_order));
      const bm = Math.min(...b[1].map(l => l.module_order));
      return am - bm;
    });
  }

  function render() {
    root.innerHTML = `
      <div class="lessons-page" dir="ltr">
        <div class="lessons-tabs" id="l-tabs"></div>
        <div class="lessons-body">
          <aside class="lessons-list" id="l-list"></aside>
          <section class="lessons-editor ${state.selectedLesson ? '' : 'empty'}" id="l-editor"></section>
        </div>
      </div>`;
    renderTabs();
    renderList();
    renderEditor();
  }

  function renderTabs() {
    const el = document.getElementById('l-tabs');
    if (!el) return;
    el.innerHTML = state.courses.map(c => `
      <button class="lessons-tab ${c.id === state.activeCourse ? 'active' : ''}" data-id="${escapeHtml(c.id)}">
        ${escapeHtml(c.label)} <span class="count">· ${c.lessonCount}</span>
      </button>`).join('') || '<span style="color:var(--c-ink-3);padding:8px">No courses found</span>';
    el.querySelectorAll('.lessons-tab').forEach(btn => {
      btn.onclick = async () => {
        state.activeCourse = btn.dataset.id;
        loadCollapsedState(state.activeCourse);
        state.selectedLessonId = null;
        state.selectedLesson = null;
        await loadLessons();
        render();
      };
    });
  }

  function renderList() {
    const el = document.getElementById('l-list');
    if (!el) return;
    const groups = groupByModule(state.lessons);
    el.innerHTML = groups.map(([mod, items]) => {
      const collapsed = state.collapsedModules.has(mod);
      return `
        <div class="lesson-module">
          <div class="lesson-module-header ${collapsed ? 'collapsed' : ''}" data-module="${escapeHtml(mod)}">
            <span>${escapeHtml(mod)}</span>
            <span class="count">${items.length} <span class="chev">▼</span></span>
          </div>
          ${collapsed ? '' : items.map(l => `
            <div class="lesson-row ${state.selectedLessonId === l.id ? 'active' : ''}" data-id="${escapeHtml(l.id)}" draggable="true">
              <span class="handle" title="Drag to reorder">⋮⋮</span>
              <span class="title">${escapeHtml(l.title || '—')}</span>
              <span class="${l.active ? 'dot-active' : 'dot-inactive'}" title="${l.active ? 'active' : 'inactive'}"></span>
            </div>`).join('')}
        </div>`;
    }).join('');
    el.innerHTML += `<button class="lessons-add-btn" id="l-add">+ Add lesson</button>`;

    el.querySelectorAll('.lesson-module-header').forEach(h => {
      h.onclick = () => {
        const m = h.dataset.module;
        if (state.collapsedModules.has(m)) state.collapsedModules.delete(m);
        else state.collapsedModules.add(m);
        saveCollapsedState();
        renderList();
      };
    });
    el.querySelectorAll('.lesson-row').forEach(row => {
      row.onclick = (e) => {
        if (e.target.classList.contains('handle')) return;
        selectLesson(row.dataset.id);
      };
      row.ondragstart = (e) => {
        e.dataTransfer.setData('text/plain', row.dataset.id);
        row.classList.add('dragging');
      };
      row.ondragend = () => { row.classList.remove('dragging'); el.querySelectorAll('.drop-above, .drop-below').forEach(r => r.classList.remove('drop-above', 'drop-below')); };
      row.ondragover = (e) => {
        e.preventDefault();
        const rect = row.getBoundingClientRect();
        const above = e.clientY < rect.top + rect.height / 2;
        el.querySelectorAll('.drop-above, .drop-below').forEach(r => { if (r !== row) r.classList.remove('drop-above', 'drop-below'); });
        row.classList.toggle('drop-above', above);
        row.classList.toggle('drop-below', !above);
      };
      row.ondrop = async (e) => {
        e.preventDefault();
        const fromId = e.dataTransfer.getData('text/plain');
        const above = row.classList.contains('drop-above');
        row.classList.remove('drop-above', 'drop-below');
        if (fromId === row.dataset.id) return;
        await doReorder(fromId, row.dataset.id, above);
      };
    });
    document.getElementById('l-add').onclick = openAddModal;
  }

  function renderEditor() {
    const el = document.getElementById('l-editor');
    if (!el) return;
    if (!state.selectedLesson) {
      el.className = 'lessons-editor empty';
      el.innerHTML = 'Select a lesson on the left';
      return;
    }
    const l = state.selectedLesson;
    el.className = 'lessons-editor';
    const bunnyLib = BUNNY_LIB[state.activeCourse] || '';
    const vid = state.draftMedia.videoId || '';
    const iframeSrc = (bunnyLib && vid) ? `https://iframe.mediadelivery.net/embed/${bunnyLib}/${encodeURIComponent(vid)}?autoplay=false` : '';
    el.innerHTML = `
      <h2>${escapeHtml(l.title || '—')}</h2>

      <label>Title</label>
      <input type="text" id="f-title" value="${escapeHtml(l.title || '')}" />

      <label>Video ID (Bunny GUID)</label>
      <input type="text" id="f-video" value="${escapeHtml(vid)}" placeholder="e.g. ab12cd34-..." />
      <div class="lessons-video-preview ${iframeSrc ? '' : 'empty'}" id="f-video-preview">
        ${iframeSrc ? `<iframe src="${escapeHtml(iframeSrc)}" allowfullscreen></iframe>` : 'No video ID yet'}
      </div>

      <label>PDF URL</label>
      <input type="url" id="f-pdf" value="${escapeHtml(state.draftMedia.pdfUrl || '')}" placeholder="https://..." />

      <label>Status</label>
      <label class="lessons-active-toggle">
        <input type="checkbox" id="f-active" ${state.draftMedia.active ? 'checked' : ''} />
        Active — visible to students
      </label>

      <label>Lesson content</label>
      <div id="f-composer"></div>

      <div class="lessons-actions">
        <button class="primary" id="f-save" disabled title="Wired in Stage B">Save changes</button>
        <button id="f-open-player" disabled title="Wired in Stage B">Open in player ↗</button>
        <button class="danger" id="f-delete" disabled title="Wired in Stage B">🗑 Delete</button>
      </div>
      <div id="f-msg" style="color:var(--c-ink-3);font-size:.85rem;margin-top:var(--sp-3)"></div>
    `;

    document.getElementById('f-video').oninput = (e) => {
      state.draftMedia.videoId = e.target.value.trim();
      const preview = document.getElementById('f-video-preview');
      const src = (bunnyLib && state.draftMedia.videoId) ? `https://iframe.mediadelivery.net/embed/${bunnyLib}/${encodeURIComponent(state.draftMedia.videoId)}?autoplay=false` : '';
      if (src) {
        preview.className = 'lessons-video-preview';
        preview.innerHTML = `<iframe src="${escapeHtml(src)}" allowfullscreen></iframe>`;
      } else {
        preview.className = 'lessons-video-preview empty';
        preview.innerHTML = 'No video ID yet';
      }
    };
    document.getElementById('f-title').oninput = (e) => { state.selectedLesson.title = e.target.value; };
    document.getElementById('f-pdf').oninput = (e) => { state.draftMedia.pdfUrl = e.target.value.trim(); };
    document.getElementById('f-active').onchange = (e) => { state.draftMedia.active = e.target.checked; };

    if (state.selectedContent) {
      state.composer = mountComposer({
        root: document.getElementById('f-composer'),
        initialBlocks: state.selectedContent.blocks,
        language: 'AR',
        onChange: (b) => { state.draftBlocks = b; },
      });
    }
  }

  async function doReorder(fromId, targetId, above) {
    console.warn('reorder wired in Stage B');
  }

  function openAddModal() {
    console.warn('add lesson wired in Stage B');
  }

  function toast(msg, kind) {
    const prev = document.querySelector('.lessons-toast');
    if (prev) prev.remove();
    const t = document.createElement('div');
    t.className = 'lessons-toast ' + (kind || '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  window.__lessonsState = state;
  window.__lessonsToast = toast;

  await loadCourses();
  if (state.activeCourse) await loadLessons();
  render();
}
