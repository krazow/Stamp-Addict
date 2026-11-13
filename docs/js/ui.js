// Small helpers for building screens without a framework.

/** h('div', { class: 'x', onclick }, child, ...) -> element. Children may be strings, nodes, arrays, null. */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'open') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : String(c));
  }
}

export function button(text, onClick, variant = 'primary', props = {}) {
  return h('button', { type: 'button', class: `btn btn-${variant}`, onclick: onClick, ...props }, text);
}

let fieldCount = 0;
/** A labelled text box. Returns { el, input }. */
export function field(label, { value = '', placeholder, hint, multiline = false, inputmode, oninput, onenter, type = 'text', autocapitalize } = {}) {
  const id = `f${++fieldCount}`;
  const input = multiline
    ? h('textarea', { id, rows: 4, placeholder, oninput })
    : h('input', { id, type, placeholder, inputmode, autocapitalize, oninput, onkeydown: onenter ? (e) => { if (e.key === 'Enter') { e.preventDefault(); onenter(); } } : null });
  input.value = value ?? '';
  const error = h('div', { class: 'field-error', hidden: true });
  const el = h('div', { class: 'field' }, h('label', { for: id }, label), input, hint ? h('div', { class: 'hint' }, hint) : null, error);
  return {
    el, input,
    setError(msg) { error.textContent = msg ?? ''; error.hidden = !msg; input.classList.toggle('invalid', !!msg); if (msg) input.focus(); },
  };
}

/** Tap-to-choose chips for a pick list. Tapping the chosen one clears it unless allowClear is false. */
export function chips(label, options, value, onChange, { allowClear = true } = {}) {
  let current = value ?? null;
  const row = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': label ?? undefined });
  const render = () => {
    row.replaceChildren(...options.map((o) => h('button', {
      type: 'button', class: `chip${o.value === current ? ' on' : ''}`, role: 'radio',
      'aria-checked': String(o.value === current),
      onclick: () => {
        current = o.value === current && allowClear ? null : o.value;
        render();
        onChange(current);
      },
    }, o.label)));
  };
  render();
  return h('div', { class: 'field' }, label ? h('div', { class: 'label' }, label) : null, row);
}

export const optionsOf = (list) => list.values.map((v) => ({ value: v, label: list.labels[v] }));

export function toggle(label, value, onChange) {
  const input = h('input', { type: 'checkbox', checked: !!value, onchange: () => onChange(input.checked) });
  return h('label', { class: 'toggle' }, input, h('span', {}, label));
}

/** A collapsible group of fields. */
export function section(title, hint, open, ...children) {
  return h('details', { class: 'section', open },
    h('summary', {}, h('span', { class: 'section-title' }, title), hint ? h('span', { class: 'hint' }, hint) : null),
    h('div', { class: 'section-body' }, ...children));
}

export function empty(title, body, action) {
  return h('div', { class: 'empty' }, h('h2', {}, title), h('p', {}, body), action ?? null);
}

/**
 * A dialog like the phone's alerts. buttons: [{ text, style: 'cancel'|'destructive'|'default', value }].
 * Resolves with the chosen button's value (cancel / Esc -> null).
 */
export function ask(title, message, buttons = [{ text: 'OK', value: true }]) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'dialog', 'aria-labelledby': 'dlg-title' });
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    const ordered = [...buttons.filter((b) => b.style === 'cancel'), ...buttons.filter((b) => b.style !== 'cancel')];
    dlg.append(
      h('h2', { id: 'dlg-title' }, title),
      message ? h('p', {}, message) : null,
      h('div', { class: 'dialog-buttons' }, ordered.map((b, i) => {
        const primary = b.style !== 'cancel' && i === ordered.length - 1;
        const variant = b.style === 'destructive' ? (primary ? 'danger-solid' : 'danger') : primary ? 'primary' : 'secondary';
        return button(b.text, () => done(b.style === 'cancel' ? null : b.value ?? true), variant);
      })),
    );
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

export const tell = (title, message) => ask(title, message);
export const confirmAction = (title, message, yes, destructive = false) =>
  ask(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: yes, style: destructive ? 'destructive' : 'default', value: true }]);

/** Opens the file chooser. Resolves with a File, or null if cancelled. */
export function chooseFile(accept) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept, style: { display: 'none' } });
    let settled = false;
    const finish = (f) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(f);
    };
    // Older browsers have no 'cancel' event: treat "window focused again, no file" as cancel.
    const onFocus = () => setTimeout(() => finish(input.files?.[0] ?? null), 1500);
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));
    document.body.append(input);
    window.addEventListener('focus', onFocus, { once: true });
    input.click();
  });
}

/**
 * Hands a file to the user: a "Save as" dialog on computers (Edge, Chrome),
 * the share sheet on phones (Drive, email, Files…), or a download.
 * Returns false if they cancelled.
 */
export async function giveFile(name, blob, type = 'application/zip') {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Stamp Addict backup', accept: { [type]: ['.zip'] } }] });
      const out = await handle.createWritable();
      await out.write(blob);
      await out.close();
      return true;
    } catch (e) {
      if (e?.name === 'AbortError') return false;
    }
  }
  const file = new File([blob], name, { type });
  if (navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ files: [file], title: name });
      return true;
    } catch (e) {
      if (e?.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

let toastTimer;
export function toast(text) {
  let el = document.getElementById('toast');
  if (!el) { el = h('div', { id: 'toast', role: 'status' }); document.body.append(el); }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

/** Simple line icons, drawn inline so the app needs no icon font. */
const ICONS = {
  back: 'M15 18l-6-6 6-6',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  cloud: 'M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1 0 9zM12 16v-5M9.5 13.5 12 11l2.5 2.5',
  stamp: 'M5 3h14v18H5zM8 7h8v8H8z',
  sets: 'M4 6h16M4 12h16M4 18h10',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  close: 'M6 6l12 12M18 6 6 18',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 11a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  check: 'M5 12l5 5 9-10',
  trash: 'M5 7h14M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7V4h6v3',
  chevron: 'M9 6l6 6-6 6',
  download: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14',
  tag: 'M3 12V4h8l10 10-8 8L3 12zM7.5 7.5h.01',
  alert: 'M12 3 2 20h20L12 3zM12 10v4M12 17h.01',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  filter: 'M4 6h16M7 12h10M10 18h4',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18',
};
export function icon(name, size = 22) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'icon');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

/**
 * A drop-down list. options: [{ value, label, group? }]. Options with a
 * group are shown under that heading. An empty first choice clears it.
 */
export function select(label, options, value, onChange, { placeholder = 'Not recorded', hint, allowEmpty = true } = {}) {
  const id = `f${++fieldCount}`;
  const el = h('select', { id, onchange: () => onChange(el.value || null) });
  if (allowEmpty) el.append(h('option', { value: '' }, placeholder));
  let group = null;
  let groupName;
  for (const o of options) {
    if (o.group !== groupName) {
      groupName = o.group;
      group = o.group ? h('optgroup', { label: o.group }) : null;
      if (group) el.append(group);
    }
    (group ?? el).append(h('option', { value: o.value }, o.label));
  }
  el.value = value ?? '';
  return h('div', { class: 'field' }, label ? h('label', { for: id }, label) : null, h('div', { class: 'select-wrap' }, el), hint ? h('div', { class: 'hint' }, hint) : null);
}

/**
 * Asks for an amount. Resolves with a number (0 or more), or null if
 * cancelled. An empty or unreadable entry asks again.
 */
export function askAmount(title, message, { label = 'Amount', placeholder = '12.50', yes = 'Save', no = 'Not now', hint } = {}) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'dialog', 'aria-labelledby': 'amt-title' });
    const f = field(label, { inputmode: 'decimal', placeholder, hint, onenter: () => submit() });
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    const submit = () => {
      const t = f.input.value.trim().replace(/[^\d.,]/g, '');
      const n = Number(t.includes(',') && !t.includes('.') ? t.replace(',', '.') : t.replace(/,/g, ''));
      if (!t || !Number.isFinite(n) || n < 0) { f.setError('Enter an amount, like 12.50.'); return; }
      done(n);
    };
    dlg.append(
      h('h2', { id: 'amt-title' }, title),
      message ? h('p', {}, message) : null,
      f.el,
      h('div', { class: 'dialog-buttons' }, button(no, () => done(null), 'secondary'), button(yes, submit, 'primary')),
    );
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });
    document.body.append(dlg);
    dlg.showModal();
    f.input.focus();
  });
}
