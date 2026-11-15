/**
 * Create / edit group dialog (used by tutors for their groups and by admins).
 */
import { TEACHING_DAYS } from '../../core/time.js';
import { esc, openModal, on, readForm, showFieldErrors, toast, errorMessage, options, alertBox } from '../ui/dom.js';
import { icon } from '../ui/icons.js';

/**
 * @param {object} ctx
 * @param {{group?: object, courses?: string[], onSaved?: Function}} opts
 */
export function openGroupForm(ctx, { group = null, courses = [], onSaved } = {}) {
  const { services, user } = ctx;
  const isEdit = Boolean(group);
  const modal = openModal({ labelledBy: 'group-form-title', wide: true });
  const days = group?.schedule.days ?? [];

  modal.body.innerHTML = `
    <div class="modal-header">
      <div class="grow"><h2 id="group-form-title">${isEdit ? `Edit ${esc(group.courseCode)} · ${esc(group.name)}` : 'Create a tutoring group'}</h2>
      <p class="muted small">${isEdit ? 'Changes are visible to members immediately.' : 'Students can find and join the group once it is created.'}</p></div>
      <button type="button" class="icon-btn" data-action="close" aria-label="Close">${icon('x')}</button>
    </div>
    <div data-slot="message"></div>
    <form data-form="group" novalidate>
      <div class="form-grid">
        <div class="field" data-field="courseCode">
          <label for="g-course">Course</label>
          ${isEdit
            ? `<input id="g-course" value="${esc(services.groups.courseLabel(group.courseCode))}" readonly>`
            : `<select id="g-course" name="courseCode">${options(courses.map((c) => ({ value: c, label: services.groups.courseLabel(c) })), '', { placeholder: courses.length ? 'Choose a course' : 'No courses on your profile' })}</select>`}
        </div>
        <div class="field" data-field="name"><label for="g-name">Group name</label><input id="g-name" name="name" maxlength="30" value="${esc(group?.name ?? 'Group A')}"></div>
      </div>
      <fieldset class="field" data-field="days">
        <legend>Meeting days</legend>
        <div class="chip-toggles">${TEACHING_DAYS.map((d) => `<label class="chip-toggle"><input type="checkbox" name="days" value="${d}" ${days.includes(d) ? 'checked' : ''}><span>${icon('check')}${d}</span></label>`).join('')}</div>
      </fieldset>
      <div class="form-grid three">
        <div class="field" data-field="start"><label for="g-start">Start time</label><input id="g-start" type="time" name="start" value="${esc(group?.schedule.start ?? '13:00')}"></div>
        <div class="field" data-field="end"><label for="g-end">End time</label><input id="g-end" type="time" name="end" value="${esc(group?.schedule.end ?? '14:30')}"></div>
        <div class="field" data-field="capacity"><label for="g-cap">Capacity</label><input id="g-cap" type="number" min="2" max="30" name="capacity" value="${esc(group?.capacity ?? 6)}"></div>
      </div>
      <div class="field" data-field="location"><label for="g-loc">Location</label><input id="g-loc" name="location" maxlength="60" placeholder="e.g. Library, Room 204 or Online (Teams)" value="${esc(group?.location ?? '')}"></div>
      <div class="field" data-field="description"><label for="g-desc">About this group</label><textarea id="g-desc" name="description" rows="3" maxlength="400">${esc(group?.description ?? '')}</textarea></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" data-action="close">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Save changes' : 'Create group'}</button>
      </div>
    </form>`;

  const form = modal.body.querySelector('form');
  on(modal.body, 'click', '[data-action="close"]', () => modal.close());
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = readForm(form);
    try {
      const saved = isEdit ? services.groups.updateGroup(user, group.id, data) : services.groups.createGroup(user, data);
      toast(isEdit ? 'Group updated.' : 'Group created.');
      modal.close();
      onSaved?.(saved);
    } catch (err) {
      if (err.fields) showFieldErrors(form, err.fields);
      modal.body.querySelector('[data-slot="message"]').innerHTML = alertBox(errorMessage(err));
    }
  });
  form.querySelector('input:not([readonly]), select')?.focus();
}
