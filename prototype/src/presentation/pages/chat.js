/**
 * Private group chat, shared by Student (Group Chat), Tutor (Messages)
 * and Admin (read/write as an authorized admin).
 *
 * SIMULATED real-time: other tabs in this browser update instantly via the
 * Observer + `storage` event; there is no server.
 */
import { Events } from '../../core/EventBus.js';
import { formatTime, formatDate } from '../../core/time.js';
import { esc, toast, errorMessage, emptyState, alertBox, initials } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { renderShell, pageHeader, backLink } from '../ui/layout.js';

function messageHtml(m, prevDay) {
  const day = formatDate(m.sentAt);
  const divider = day !== prevDay ? `<div class="day-divider"><span>${esc(day)}</span></div>` : '';
  const who = `${m.senderName}${m.senderIsTutor ? ' (Tutor)' : ''}${m.senderIsAdmin ? ' (Admin)' : ''}`;
  if (m.mine) {
    return `${divider}<div class="msg mine"><div class="msg-meta">You · ${esc(formatTime(m.sentAt))}</div><div class="bubble">${esc(m.text)}</div></div>`;
  }
  return `${divider}<div class="msg"><span class="avatar xs" aria-hidden="true">${esc(initials(m.senderName))}</span><div><div class="msg-meta">${esc(who)} · ${esc(formatTime(m.sentAt))}</div><div class="bubble">${esc(m.text)}</div></div></div>`;
}

/**
 * @param {object} ctx router context
 * @param {{basePath:string, active:string, title:string, subtitle:string, adminGroupId?:string}} opts
 */
export function chatPage(ctx, { basePath, active, title, subtitle }) {
  const { services, user, role } = ctx;
  const isAdmin = role === 'admin';
  const groups = isAdmin ? [] : services.chat.chatGroupsFor(user, role);
  const selectedId = ctx.params.groupId ?? groups[0]?.id ?? null;

  let conversation = '';
  let selected = null;
  if (selectedId) {
    try {
      selected = services.groups.getGroupDetails(selectedId);
      services.chat.listMessages(user, selectedId); // permission check
    } catch (err) {
      conversation = `<div class="chat-empty">${alertBox(errorMessage(err))}</div>`;
      selected = null;
    }
  }

  const list = isAdmin ? '' : `
    <aside class="chat-list card" aria-label="Group chats">
      <h2 class="card-title">Group chats</h2>
      ${groups.length ? `<ul>${groups.map((g) => `
        <li><a class="chat-item ${g.id === selectedId ? 'active' : ''}" href="#${basePath}/${esc(g.id)}" ${g.id === selectedId ? 'aria-current="true"' : ''}>
          <span class="avatar sm" aria-hidden="true">${esc(g.courseCode.split(' ')[0].slice(0, 2))}</span>
          <span class="chat-item-text"><strong>${esc(g.courseCode)} · ${esc(role === 'tutor' ? g.name : 'Study Group')}</strong><span class="muted small truncate" data-preview="${esc(g.id)}">${esc(g.lastMessage)}</span></span>
        </a></li>`).join('')}</ul>`
        : emptyState('No group chats yet', role === 'tutor' ? 'Create a group to start chatting.' : 'Join a tutoring group to chat with its members.',
          role === 'student' ? '<a class="btn btn-primary btn-sm" href="#/student/home">Browse groups</a>' : '<a class="btn btn-primary btn-sm" href="#/tutor/groups">My groups</a>')}
    </aside>`;

  if (selected && !conversation) {
    conversation = `
      <div class="chat-head">
        <h2>${esc(selected.courseCode)} · ${esc(selected.courseTitle)}</h2>
        <p class="muted small">Tutor: ${esc(selected.tutorName)} · ${selected.memberCount} members${isAdmin ? ' · viewing as admin' : ''}</p>
      </div>
      <p class="chat-privacy">${icon('lock')} Only members of this group${isAdmin ? ', its tutor and admins' : ' and its tutor'} can see these messages.</p>
      <div class="chat-messages" data-slot="messages" aria-live="polite"></div>
      <form class="chat-form" data-form="chat" novalidate>
        <label class="sr-only" for="chat-input">Message</label>
        <input id="chat-input" name="text" placeholder="Write a message..." autocomplete="off" maxlength="500">
        <button type="submit" class="btn btn-primary">${icon('send')} Send</button>
      </form>`;
  } else if (!conversation) {
    conversation = `<div class="chat-empty">${emptyState('Select a chat', 'Choose a group on the left to see its messages.')}</div>`;
  }

  const main = renderShell(ctx, {
    active,
    content: `
      ${isAdmin && selected ? backLink(`/admin/groups/${selected.id}`, 'Back to group') : ''}
      ${pageHeader(title, subtitle)}
      <div class="chat-layout ${isAdmin ? 'no-list' : ''}">
        ${list}
        <section class="chat-panel card">${conversation}</section>
      </div>`,
  });

  const messagesEl = main.querySelector('[data-slot="messages"]');
  const renderMessages = () => {
    if (!messagesEl || !selected) return;
    try {
      const msgs = services.chat.listMessages(user, selected.id);
      let prevDay = '';
      messagesEl.innerHTML = msgs.length
        ? msgs.map((m) => { const html = messageHtml(m, prevDay); prevDay = formatDate(m.sentAt); return html; }).join('')
        : '<p class="muted center">No messages yet. Say hello to your group!</p>';
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } catch (err) {
      messagesEl.innerHTML = alertBox(errorMessage(err));
    }
  };
  renderMessages();

  // Observer: new messages (from this tab or another tab) appear immediately.
  ctx.subscribe(Events.MESSAGES, (payload) => {
    if (!payload || !selected || payload.groupId === selected.id || payload.external) renderMessages();
    if (!isAdmin) {
      services.chat.chatGroupsFor(user, role).forEach((g) => {
        const el = main.querySelector(`[data-preview="${g.id}"]`);
        if (el) el.textContent = g.lastMessage;
      });
    }
  });

  const form = main.querySelector('[data-form="chat"]');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.text;
    try {
      services.chat.send(user, selected.id, input.value);
      input.value = '';
      input.focus();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  });
}
