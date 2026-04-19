import { api } from '../api.js';
import { openApprovalModal, renderToggleLessonPreview } from '../ui/approval-modal.js';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export default async function mount(root) {
  root.innerHTML = '<h2 style="color:var(--gold)">Lessons</h2><p style="color:var(--silver)">Loading…</p>';
  let { lessons } = await api('/api/data/lessons');

  function render() {
    const byCourseModule = {};
    for (const l of lessons) {
      byCourseModule[l.course] ??= {};
      byCourseModule[l.course][l.module] ??= [];
      byCourseModule[l.course][l.module].push(l);
    }
    const groups = Object.entries(byCourseModule)
      .map(([course, modules]) => {
        const moduleBlocks = Object.entries(modules)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([mod, items]) => {
            items.sort((a, b) => a.order - b.order);
            const rows = items.map(l => `
              <tr data-id="${escapeHtml(l.lessonId)}">
                <td>${l.order}</td>
                <td>${escapeHtml(l.title)}</td>
                <td>
                  <label class="toggle">
                    <input type="checkbox" ${l.active ? 'checked' : ''} data-id="${escapeHtml(l.lessonId)}" />
                    <span>${l.active ? 'ON' : 'OFF'}</span>
                  </label>
                </td>
              </tr>`).join('');
            return `
              <h4 style="margin-top:16px;color:var(--gold)">${escapeHtml(mod)}</h4>
              <table class="data-table">
                <thead><tr><th>#</th><th>Lesson</th><th>Active</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>`;
          }).join('');
        return `<section><h3 style="color:var(--ivory);margin-top:24px">${escapeHtml(course)}</h3>${moduleBlocks}</section>`;
      }).join('');
    root.innerHTML = `<h2 style="color:var(--gold);margin-bottom:8px">Lessons</h2>
      <p style="color:var(--silver);font-size:.9rem;margin-bottom:16px">Toggle active → preview → approve. Writes to <code>Lessons</code> + <code>AuditLog</code>.</p>
      ${groups}`;

    for (const input of root.querySelectorAll('input[type=checkbox][data-id]')) {
      input.addEventListener('change', (e) => handleToggle(e.target));
    }
  }

  async function handleToggle(input) {
    const lessonId = input.dataset.id;
    const active = input.checked;
    input.checked = !active;
    input.disabled = true;
    try {
      const stage = await api('/api/writes/toggle_lesson', {
        method: 'POST',
        body: JSON.stringify({ lessonId, active }),
      });
      openApprovalModal({
        title: 'Confirm lesson toggle',
        previewHtml: renderToggleLessonPreview(stage.preview),
        pendingWriteId: stage.id,
        onApproved: async () => {
          lessons = (await api('/api/data/lessons')).lessons;
          render();
        },
        onRejected: () => { input.disabled = false; },
      });
    } catch (e) {
      alert(`Stage failed: ${e.message}`);
    } finally {
      input.disabled = false;
    }
  }

  render();
}
