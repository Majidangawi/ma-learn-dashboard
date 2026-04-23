import { api } from '../api.js';
import { mountComposer } from '../composer/index.js';

const PRODUCT_LABELS = {
  'intro-to-creative-ai':    'T2',
  'creative-ai-workshop-t3': 'T3',
  'beyond-lighting':         'BL',
  'prompt-pack':             'PP',
};

// Bunny library IDs per course (confirmed by Majid 2026-04-23).
const BUNNY_LIB = {
  'intro-to-creative-ai':    '637491',   // T2 (ITCAI) Bunny library
  'beyond-lighting':         '634652',   // BL Bunny library
};

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export default async function mount(root) {
  root.innerHTML = '<div class="lessons-page" dir="ltr"><div class="lessons-tabs">Loading…</div><div class="lessons-body"><div class="lessons-editor empty">Select a lesson from the right</div><div class="lessons-list"></div></div></div>';

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
    state.selectedContent = { blocks: [], html: '' };
    renderList();
    renderEditor();
    loadLessonContent(id)
      .then(() => renderEditor())
      .catch(e => {
        console.error('loadLessonContent failed', e);
        toast('Content load failed: ' + e.message, 'error');
      });
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
          <section class="lessons-editor ${state.selectedLesson ? '' : 'empty'}" id="l-editor"></section>
          <aside class="lessons-list" id="l-list"></aside>
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
      el.innerHTML = 'Select a lesson from the right';
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
        <button class="primary" id="f-save">Save changes</button>
        <button id="f-open-player">Open in player ↗</button>
        <button class="danger" id="f-delete">🗑 Delete</button>
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

    document.getElementById('f-save').onclick = doSave;
    document.getElementById('f-open-player').onclick = doOpenInPlayer;
    document.getElementById('f-delete').onclick = doDelete;
  }

  async function doSave() {
    if (!state.selectedLesson) return;
    const msg = document.getElementById('f-msg');
    msg.textContent = 'Saving…';
    try {
      const newTitle = document.getElementById('f-title').value.trim();
      if (newTitle && newTitle !== state.selectedLesson.title) {
        console.warn('Title changed — save_lesson_media does not persist title in v1. Edit sheet directly.');
      }
      await api('/api/writes/lesson/save_media', {
        method: 'POST',
        body: JSON.stringify({
          lessonId: state.selectedLesson.id,
          videoId: state.draftMedia.videoId || '',
          pdfUrl: state.draftMedia.pdfUrl || '',
          active: !!state.draftMedia.active,
        }),
      });

      if (state.draftBlocks) {
        const { renderPreview } = await import('../composer/preview.js');
        const html = renderPreview(state.draftBlocks, 'AR', {}).replace(/<div dir="[^"]*"[^>]*>|<\/div>|<hr[^>]*>|<p style="margin:0[^"]*"[^>]*>[\s\S]*$/g, '');
        await api('/api/writes/lesson/save_content', {
          method: 'POST',
          body: JSON.stringify({
            lessonId: state.selectedLesson.id,
            blocks: state.draftBlocks,
            html: html,
          }),
        });
      }

      msg.textContent = 'Saved ✓';
      toast('Lesson saved', 'success');
      await loadLessons();
      renderList();
    } catch (e) {
      msg.textContent = `Error: ${e.message}`;
      toast(`Save failed: ${e.message}`, 'error');
    }
  }

  function doOpenInPlayer() {
    if (!state.selectedLesson) return;
    const testTokenPerCourse = {
      'intro-to-creative-ai': 'MAL-T2-PREVIEW',
      'beyond-lighting':      'MAL-BL-PREVIEW',
    };
    const token = testTokenPerCourse[state.activeCourse];
    if (!token) { toast('No admin-preview token configured for this course', 'error'); return; }
    const url = `https://player.malearnsa.com/watch.html?token=${encodeURIComponent(token)}&course=${encodeURIComponent(state.activeCourse)}&lesson=${encodeURIComponent(state.selectedLesson.id)}`;
    window.open(url, '_blank', 'noopener');
  }

  function doDelete() {
    if (!state.selectedLesson) return;
    const l = state.selectedLesson;
    const o = document.createElement('div');
    o.className = 'modal-overlay';
    o.innerHTML = `
      <div class="modal-card" style="max-width:480px">
        <h3>Delete this lesson?</h3>
        <div class="delete-preview">
          <div class="n">${escapeHtml(l.module || '')} · ${escapeHtml(l.title || '—')}</div>
          <div class="e">${l.video_id ? 'Video: ' + escapeHtml(l.video_id) : '<em>no video</em>'}</div>
          <div class="facts">PDF: ${l.pdf_url ? escapeHtml(l.pdf_url) : '—'}<br>Active: ${l.active ? 'yes' : 'no'}</div>
        </div>
        <p style="color:var(--c-ink-2);font-size:.85rem;line-height:1.5">
          This removes the row from the Lessons sheet AND the LessonContent row.
          Students who bookmarked the deep link will see a 404.
        </p>
        <div class="modal-actions">
          <button class="btn-ghost" id="x-cancel">Cancel</button>
          <button class="btn-primary" id="x-go" style="background:var(--c-danger);color:#fff">Delete lesson</button>
        </div>
        <div class="modal-msg" id="x-msg"></div>
      </div>`;
    document.body.appendChild(o);
    o.addEventListener('mousedown', e => { if (e.target === o) o.remove(); });
    o.querySelector('#x-cancel').onclick = () => o.remove();
    o.querySelector('#x-go').onclick = async () => {
      o.querySelector('#x-msg').textContent = 'Deleting…';
      try {
        const r = await api('/api/writes/lesson/delete', {
          method: 'POST', body: JSON.stringify({ lessonId: l.id }),
        });
        if (r.success || r.ok) {
          o.remove();
          toast('Lesson deleted', 'success');
          state.selectedLessonId = null; state.selectedLesson = null;
          await loadLessons();
          render();
        } else {
          o.querySelector('#x-msg').textContent = `Error: ${r.reason || r.error || 'unknown'}`;
        }
      } catch (e) {
        o.querySelector('#x-msg').textContent = `Error: ${e.message}`;
      }
    };
  }

  async function doReorder(fromId, targetId, above) {
    const target = state.lessons.find(l => l.id === targetId);
    const moving = state.lessons.find(l => l.id === fromId);
    if (!target || !moving) return;
    const newModuleOrder = target.module_order;
    const newLessonOrder = above ? target.lesson_order - 0.5 : target.lesson_order + 0.5;
    try {
      await api('/api/writes/lesson/reorder', {
        method: 'POST',
        body: JSON.stringify({
          lessonId: fromId,
          moduleOrder: newModuleOrder,
          lessonOrder: Math.max(1, Math.round(newLessonOrder * 2) / 2),
        }),
      });
      toast('Reordered', 'success');
      await loadLessons();
      renderList();
    } catch (e) {
      toast(`Reorder failed: ${e.message}`, 'error');
    }
  }

  function openAddModal() {
    const modules = Array.from(new Set(state.lessons.map(l => l.module))).filter(Boolean);
    const o = document.createElement('div');
    o.className = 'modal-overlay';
    o.innerHTML = `
      <div class="modal-card" style="max-width:480px">
        <h3>Add a new lesson</h3>
        <div class="form-field">
          <label>Module (existing or new)</label>
          <input id="a-module" list="a-module-list" value="" />
          <datalist id="a-module-list">${modules.map(m => `<option value="${escapeHtml(m)}">`).join('')}</datalist>
        </div>
        <div class="form-field"><label>Title</label><input id="a-title" /></div>
        <div class="modal-actions">
          <button class="btn-ghost" id="a-cancel">Cancel</button>
          <button class="btn-primary" id="a-go">Add lesson</button>
        </div>
        <div class="modal-msg" id="a-msg"></div>
      </div>`;
    document.body.appendChild(o);
    o.addEventListener('mousedown', e => { if (e.target === o) o.remove(); });
    o.querySelector('#a-cancel').onclick = () => o.remove();
    o.querySelector('#a-go').onclick = async () => {
      const module = o.querySelector('#a-module').value.trim();
      const title = o.querySelector('#a-title').value.trim();
      if (!module || !title) { o.querySelector('#a-msg').textContent = 'Module + title required.'; return; }
      const existing = state.lessons.filter(l => l.module === module);
      const module_order = existing.length ? existing[0].module_order : (Math.max(0, ...state.lessons.map(l => l.module_order)) + 1);
      const lesson_order = existing.length ? Math.max(...existing.map(l => l.lesson_order)) + 1 : 1;
      o.querySelector('#a-msg').textContent = 'Adding…';
      try {
        const r = await api('/api/writes/lesson/add', {
          method: 'POST',
          body: JSON.stringify({
            course: state.activeCourse, module, module_order, lesson_order, title,
          }),
        });
        if (r.success) {
          o.remove();
          toast('Lesson added', 'success');
          await loadLessons();
          renderList();
        } else {
          o.querySelector('#a-msg').textContent = `Error: ${r.reason || r.error || 'unknown'}`;
        }
      } catch (e) {
        o.querySelector('#a-msg').textContent = `Error: ${e.message}`;
      }
    };
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
