/**
 * Group details dialog + Join button (US-04, Figma: Student - Group Details).
 *
 * States from the Figma file: Open, Full, Joined, Already a member.
 */
import { ErrorCodes } from '../../core/errors.js';
import { Events } from '../../core/EventBus.js';
import { esc, openModal, avatar, alertBox, on, toast, errorMessage } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { groupStatusBadge, detailRow } from '../ui/components.js';
import { formatSchedule } from '../../core/time.js';

export function openGroupDetails(ctx, groupId, { onClose } = {}) {
  const { services, user } = ctx;
  let off = () => {};
  const modal = openModal({ labelledBy: 'group-title', wide: true, onClose: () => { off(); onClose?.(); } });
  let banner = '';

  function render() {
    let g;
    try {
      g = services.groups.getGroupDetails(groupId, user.id);
    } catch (err) {
      modal.body.innerHTML = `${alertBox(errorMessage(err))}<div class="modal-actions"><button class="btn btn-outline" data-action="close">Close</button></div>`;
      return;
    }
    if (!banner) {
      if (g.isMember) banner = alertBox("You're already a member of this group.", 'success');
      else if (g.isClosed) banner = alertBox('This group is closed and is not accepting new members.', 'info');
      else if (g.isFull) banner = alertBox("This group is full. You can't join it, but you can browse other groups.", 'info');
    }

    let primary;
    if (g.isMember) primary = `<a class="btn btn-primary" href="#/student/chat/${esc(g.id)}">Open chat</a>`;
    else if (g.isFull || g.isClosed) primary = `<button type="button" class="btn btn-primary" disabled>${g.isClosed ? 'Group closed' : 'Group full'}</button>`;
    else primary = `<button type="button" class="btn btn-primary" data-action="join">Join Group</button>`;

    modal.body.innerHTML = `
      <div class="modal-header">
        <span class="icon-tile">${icon('book')}</span>
        <div class="grow">
          <p class="eyebrow">${esc(g.courseCode)} · ${esc(g.name)}</p>
          <h2 id="group-title">${esc(g.courseTitle)}</h2>
          ${groupStatusBadge(g)}
        </div>
        <button type="button" class="icon-btn" data-action="close" aria-label="Close">${icon('x')}</button>
      </div>
      <div data-slot="banner">${banner}</div>
      <div class="modal-grid">
        <div>
          <ul class="detail-icons">
            <li>${icon('user')}<div><span class="label">Tutor</span><strong>${esc(g.tutorName)}</strong></div></li>
            <li>${icon('calendar')}<div><span class="label">Schedule</span><strong>${esc(formatSchedule(g.schedule))}</strong></div></li>
            <li>${icon('pin')}<div><span class="label">Location</span><strong>${esc(g.location)}</strong></div></li>
            <li>${icon('users')}<div><span class="label">Capacity</span><strong data-testid="capacity">${g.memberCount} of ${g.capacity} members · ${g.spotsLeft} ${g.spotsLeft === 1 ? 'spot' : 'spots'} left</strong></div></li>
          </ul>
          <h3 class="section-label">About this group</h3>
          <p>${esc(g.description || 'No description yet.')}</p>
        </div>
        <div class="members-box">
          <h3 class="section-label">Group members · ${g.memberCount} of ${g.capacity}</h3>
          <ul class="member-list">
            ${g.members.map((m) => `<li>${avatar(m.name, 'sm')}<div><strong>${esc(m.name)}${m.id === user.id ? ' (you)' : ''}</strong><span class="muted small">${esc(m.studentId)}</span></div></li>`).join('') || '<li class="muted">No members yet — be the first!</li>'}
          </ul>
          <p class="muted small privacy-note">${icon('lock')} Member names and student IDs are visible only to logged-in AUBH users.</p>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" data-action="close">Close</button>
        ${primary}
      </div>`;
  }

  on(modal.body, 'click', '[data-action="close"]', () => modal.close());
  on(modal.body, 'click', '[data-action="join"]', (e, btn) => {
    btn.disabled = true;
    btn.textContent = 'Joining…';
    try {
      const result = services.groups.joinGroup(user.id, groupId);
      banner = alertBox(`You joined this group (${result.updatedCount} members now). Message the members to plan your first session.`, 'success');
      toast('You joined the group.');
    } catch (err) {
      const tone = [ErrorCodes.ALREADY_MEMBER].includes(err.code) ? 'success' : 'error';
      banner = alertBox(errorMessage(err), tone);
    }
    render();
  });

  // Observer: if another tab changes this group, the dialog shows the new numbers.
  off = services.bus.subscribe(Events.GROUPS, () => { if (modal.overlay.isConnected) render(); });

  render();
  modal.body.querySelector('[data-action="close"]')?.focus();
  return modal;
}
