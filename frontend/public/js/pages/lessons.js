import { api } from '../api.js';
import { openApprovalModal, renderToggleLessonPreview } from '../ui/approval-modal.js';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// Human-readable course names for the existing slugs.
const COURSE_LABELS = {
  't2': 'T2 — Intro to Creative AI',
  'intro-to-creative-ai': 'T2 — Intro to Creative AI',
  't3': 'T3 — Creative AI Workshop',
  'creative-ai-workshop-t3': 'T3 — Creative AI Workshop',
  'beyond-lighting': 'Beyond Lighting',
  'prompt-pack': 'Prompt Pack',
};
const courseLabel = (slug) => COURSE_LABELS[slug] || slug;

export default async function mount(root) {
  root.innerHTML = '<h2 style="color:var(--gold)">Lessons</h2><p style="color:var(--silver)">Loading…</p>';
  let { lessons } = await api('/api/data/lessons');
  const expanded = new Set();

  function render() {
    // Group lessons: course → module → [lessons]. Preserve moduleOrder on the group so we can sort numerically.
    const byCourse = new Map();
    for (const l of lessons) {
      if (!byCourse.has(l.course)) byCourse.set(l.course, new Map());
      const modules = byCourse.get(l.course);
      if (!modules.has(l.module)) modules.set(l.module, { moduleOrder: l.moduleOrder ?? 0, items: [] });
      modules.get(l.module).items.push(l);
    }

    const courseCards = [...byCourse.entries()].map(([course, modules]) => {
      const courseTotal = [...modules.values()].reduce((acc, m) => acc + m.items.length, 0);
      const courseActive = [...modules.values()].reduce((acc, m) => acc + m.items.filter(l => l.active).length, 0);
      const isOpen = expanded.has(course);

      const moduleSections = [...modules.entries()]
        .sort((a, b) => {
          // Sort by moduleOrder (numeric). Fall back to module name if orders tie.
          const ao = a[1].moduleOrder || 0, bo = b[1].moduleOrder || 0;
          if (ao !== bo) return ao - bo;
          return a[0].localeCompare(b[0]);
        })
        .map(([mod, group]) => {
          group.items.sort((a, b) => a.order - b.order);
          const rows = group.items.map(l => `
            <tr data-id="${escapeHtml(l.lessonId)}">
              <td style="width:40px">${l.order}</td>
              <td>${escapeHtml(l.title)}</td>
              <td style="width:120px">
                <label class="toggle">
                  <input type="checkbox" ${l.active ? 'checked' : ''} data-id="${escapeHtml(l.lessonId)}" />
                  <span>${l.active ? 'ON' : 'OFF'}</span>
                </label>
              </td>
            </tr>`).join('');
          return `
            <h4 style="margin-top:16px;color:var(--gold);font-size:.95rem">${escapeHtml(mod)}</h4>
            <table class="data-table">
              <thead><tr><th>#</th><th>Lesson</th><th>Active</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>`;
        }).join('');

      return `
        <section class="course-card" data-course="${escapeHtml(course)}">
          <button class="course-card-head" data-toggle="${escapeHtml(course)}">
            <span class="course-card-title">${escapeHtml(courseLabel(course))}</span>
            <span class="course-card-meta">${courseActive}/${courseTotal} active</span>
            <span class="course-card-caret">${isOpen ? '▾' : '▸'}</span>
          </button>
          <div class="course-card-body" style="${isOpen ? '' : 'display:none'}">
            ${moduleSections}
          </div>
        </section>`;
    }).join('');

    root.innerHTML = `
      <h2 style="color:var(--gold);margin-bottom:8px">Lessons</h2>
      <p style="color:var(--silver);font-size:.9rem;margin-bottom:16px">Click a course card to expand. Toggle any lesson → preview → approve. Writes to <code>Lessons</code> + <code>AuditLog</code>.</p>
      ${courseCards}`;

    for (const b of root.querySelectorAll('button[data-toggle]')) {
      b.addEventListener('click', () => {
        const c = b.dataset.toggle;
        if (expanded.has(c)) expanded.delete(c); else expanded.add(c);
        render();
      });
    }
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
