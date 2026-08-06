/**
 * Content types and the exact payload syntax each one produces.
 *
 * Escaping is where most QR tools quietly break: a Wi-Fi password containing
 * a semicolon, a contact name containing a comma, an address with a newline.
 * Each builder below escapes to the convention the readers actually
 * implement, and the app's round-trip check catches it when they do not.
 */

import type { EcLevel } from './spec.ts';

export type FieldType =
  | 'text'
  | 'url'
  | 'email'
  | 'tel'
  | 'multiline'
  | 'select'
  | 'switch'
  | 'number';

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: { value: string; label: string }[];
  optional?: boolean;
  help?: string;
};

export type Values = Record<string, string>;

export type ContentTypeDef = {
  id: string;
  label: string;
  blurb: string;
  fields: FieldDef[];
  build: (v: Values) => string;
  summarize: (v: Values) => string;
  /** Error-correction level that suits this content type's typical use. */
  suggestEc: EcLevel;
};

const val = (v: Values, k: string): string => (v[k] ?? '').trim();

/* ------------------------------------------------------------------ */
/* Escaping helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * WIFI: and MECARD: share an escaping convention — backslash before any of
 * \ ; , " and :
 */
export function escapeMecard(s: string): string {
  return s.replace(/([\\;,":])/g, '\\$1');
}

/** vCard 3.0 escaping (RFC 2426): backslash, comma, semicolon, newline. */
export function escapeVcard(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** iCalendar text escaping (RFC 5545) — same shape, different newline rule. */
export function escapeIcal(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Normalises a phone number to the tel: / SMSTO: shape readers expect. */
export function normalizePhone(s: string): string {
  const trimmed = s.trim();
  const plus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^0-9]/g, '');
  return (plus ? '+' : '') + digits;
}

/** Adds a scheme when the user typed a bare host. */
export function normalizeUrl(s: string): string {
  const t = s.trim();
  if (!t) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return t;
  return 'https://' + t;
}

function query(params: [string, string][]): string {
  const parts = params
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  return parts.length ? '?' + parts.join('&') : '';
}

/* ------------------------------------------------------------------ */
/* Content types                                                        */
/* ------------------------------------------------------------------ */

export const CONTENT_TYPES: ContentTypeDef[] = [
  {
    id: 'link',
    label: 'Link',
    blurb: 'Open a web page.',
    suggestEc: 'M',
    fields: [
      { key: 'url', label: 'Address', type: 'url', placeholder: 'yoursite.com' },
    ],
    build: (v) => normalizeUrl(val(v, 'url')),
    summarize: (v) => normalizeUrl(val(v, 'url')) || 'Link',
  },

  {
    id: 'text',
    label: 'Text',
    blurb: 'Plain text, shown as-is.',
    suggestEc: 'M',
    fields: [
      { key: 'text', label: 'Text', type: 'multiline', placeholder: 'Anything at all' },
    ],
    build: (v) => v.text ?? '',
    summarize: (v) => val(v, 'text').split('\n')[0] || 'Text',
  },

  {
    id: 'wifi',
    label: 'Wi-Fi',
    blurb: 'Join a network without typing the password.',
    suggestEc: 'Q',
    fields: [
      { key: 'ssid', label: 'Network name', type: 'text', placeholder: 'Studio 5G' },
      {
        key: 'security', label: 'Security', type: 'select',
        options: [
          { value: 'WPA', label: 'WPA / WPA2 / WPA3' },
          { value: 'WEP', label: 'WEP' },
          { value: 'nopass', label: 'Open (no password)' },
        ],
      },
      { key: 'password', label: 'Password', type: 'text', optional: true },
      { key: 'hidden', label: 'Hidden network', type: 'switch', optional: true },
    ],
    build: (v) => {
      const security = val(v, 'security') || 'WPA';
      const parts = [`T:${security}`, `S:${escapeMecard(val(v, 'ssid'))}`];
      if (security !== 'nopass') parts.push(`P:${escapeMecard(v.password ?? '')}`);
      if (val(v, 'hidden') === 'true') parts.push('H:true');
      return `WIFI:${parts.join(';')};;`;
    },
    summarize: (v) => val(v, 'ssid') || 'Wi-Fi',
  },

  {
    id: 'contact',
    label: 'Contact',
    blurb: 'A full contact card, saved straight to Contacts.',
    suggestEc: 'Q',
    fields: [
      { key: 'firstName', label: 'First name', type: 'text' },
      { key: 'lastName', label: 'Last name', type: 'text', optional: true },
      { key: 'org', label: 'Company', type: 'text', optional: true },
      { key: 'title', label: 'Job title', type: 'text', optional: true },
      { key: 'phone', label: 'Phone', type: 'tel', optional: true },
      { key: 'email', label: 'Email', type: 'email', optional: true },
      { key: 'url', label: 'Website', type: 'url', optional: true },
      { key: 'address', label: 'Address', type: 'text', optional: true },
      { key: 'note', label: 'Note', type: 'multiline', optional: true },
    ],
    build: (v) => {
      const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
      const first = val(v, 'firstName');
      const last = val(v, 'lastName');
      lines.push(`N:${escapeVcard(last)};${escapeVcard(first)};;;`);
      lines.push(`FN:${escapeVcard([first, last].filter(Boolean).join(' '))}`);
      if (val(v, 'org')) lines.push(`ORG:${escapeVcard(val(v, 'org'))}`);
      if (val(v, 'title')) lines.push(`TITLE:${escapeVcard(val(v, 'title'))}`);
      if (val(v, 'phone')) lines.push(`TEL;TYPE=CELL:${normalizePhone(val(v, 'phone'))}`);
      if (val(v, 'email')) lines.push(`EMAIL;TYPE=INTERNET:${escapeVcard(val(v, 'email'))}`);
      if (val(v, 'url')) lines.push(`URL:${normalizeUrl(val(v, 'url'))}`);
      if (val(v, 'address')) lines.push(`ADR;TYPE=WORK:;;${escapeVcard(val(v, 'address'))};;;;`);
      if (val(v, 'note')) lines.push(`NOTE:${escapeVcard(val(v, 'note'))}`);
      lines.push('END:VCARD');
      return lines.join('\n');
    },
    summarize: (v) =>
      [val(v, 'firstName'), val(v, 'lastName')].filter(Boolean).join(' ') || 'Contact',
  },

  {
    id: 'email',
    label: 'Email',
    blurb: 'Open a pre-filled message.',
    suggestEc: 'M',
    fields: [
      { key: 'to', label: 'To', type: 'email', placeholder: 'hello@example.com' },
      { key: 'subject', label: 'Subject', type: 'text', optional: true },
      { key: 'body', label: 'Message', type: 'multiline', optional: true },
    ],
    build: (v) =>
      `mailto:${val(v, 'to')}` +
      query([
        ['subject', val(v, 'subject')],
        ['body', v.body ?? ''],
      ]),
    summarize: (v) => val(v, 'to') || 'Email',
  },

  {
    id: 'sms',
    label: 'Message',
    blurb: 'Open Messages with the text ready to send.',
    suggestEc: 'M',
    fields: [
      { key: 'phone', label: 'Number', type: 'tel', placeholder: '+1 416 555 0123' },
      { key: 'message', label: 'Message', type: 'multiline', optional: true },
    ],
    build: (v) => {
      const phone = normalizePhone(val(v, 'phone'));
      const body = v.message ?? '';
      return body ? `SMSTO:${phone}:${body}` : `SMSTO:${phone}:`;
    },
    summarize: (v) => normalizePhone(val(v, 'phone')) || 'Message',
  },

  {
    id: 'phone',
    label: 'Phone',
    blurb: 'Start a call.',
    suggestEc: 'M',
    fields: [{ key: 'phone', label: 'Number', type: 'tel', placeholder: '+1 416 555 0123' }],
    build: (v) => `tel:${normalizePhone(val(v, 'phone'))}`,
    summarize: (v) => normalizePhone(val(v, 'phone')) || 'Phone',
  },

  {
    id: 'location',
    label: 'Location',
    blurb: 'Drop a pin on the map.',
    suggestEc: 'M',
    fields: [
      { key: 'lat', label: 'Latitude', type: 'number', placeholder: '43.5183' },
      { key: 'lng', label: 'Longitude', type: 'number', placeholder: '-79.8774' },
      { key: 'label', label: 'Place name', type: 'text', optional: true },
    ],
    build: (v) => {
      const base = `geo:${val(v, 'lat')},${val(v, 'lng')}`;
      const label = val(v, 'label');
      return label ? `${base}?q=${val(v, 'lat')},${val(v, 'lng')}(${encodeURIComponent(label)})` : base;
    },
    summarize: (v) => val(v, 'label') || `${val(v, 'lat')}, ${val(v, 'lng')}` || 'Location',
  },

  {
    id: 'event',
    label: 'Event',
    blurb: 'Add a calendar entry.',
    suggestEc: 'Q',
    fields: [
      { key: 'title', label: 'Title', type: 'text', placeholder: 'Studio open house' },
      { key: 'location', label: 'Where', type: 'text', optional: true },
      { key: 'start', label: 'Starts', type: 'text', placeholder: '2026-09-12 18:00' },
      { key: 'end', label: 'Ends', type: 'text', placeholder: '2026-09-12 21:00', optional: true },
      { key: 'notes', label: 'Notes', type: 'multiline', optional: true },
    ],
    build: (v) => {
      const stamp = (s: string): string => {
        const t = s.trim().replace(/[-:]/g, '').replace(/\s+/g, 'T');
        if (!t) return '';
        return t.length === 8 ? t : t.padEnd(15, '0').slice(0, 15) + '00';
      };
      const lines = ['BEGIN:VEVENT'];
      lines.push(`SUMMARY:${escapeIcal(val(v, 'title'))}`);
      if (val(v, 'location')) lines.push(`LOCATION:${escapeIcal(val(v, 'location'))}`);
      if (val(v, 'start')) lines.push(`DTSTART:${stamp(val(v, 'start'))}`);
      if (val(v, 'end')) lines.push(`DTEND:${stamp(val(v, 'end'))}`);
      if (val(v, 'notes')) lines.push(`DESCRIPTION:${escapeIcal(val(v, 'notes'))}`);
      lines.push('END:VEVENT');
      return lines.join('\n');
    },
    summarize: (v) => val(v, 'title') || 'Event',
  },

  {
    id: 'whatsapp',
    label: 'WhatsApp',
    blurb: 'Open a WhatsApp chat.',
    suggestEc: 'M',
    fields: [
      { key: 'phone', label: 'Number', type: 'tel', placeholder: '+1 416 555 0123' },
      { key: 'message', label: 'Message', type: 'multiline', optional: true },
    ],
    build: (v) =>
      `https://wa.me/${normalizePhone(val(v, 'phone')).replace('+', '')}` +
      query([['text', v.message ?? '']]),
    summarize: (v) => normalizePhone(val(v, 'phone')) || 'WhatsApp',
  },

  {
    id: 'social',
    label: 'Social',
    blurb: 'Send people to your profile.',
    suggestEc: 'M',
    fields: [
      {
        key: 'network', label: 'Network', type: 'select',
        options: [
          { value: 'instagram', label: 'Instagram' },
          { value: 'x', label: 'X' },
          { value: 'tiktok', label: 'TikTok' },
          { value: 'linkedin', label: 'LinkedIn' },
          { value: 'youtube', label: 'YouTube' },
          { value: 'facebook', label: 'Facebook' },
          { value: 'github', label: 'GitHub' },
        ],
      },
      { key: 'handle', label: 'Handle', type: 'text', placeholder: 'yourname' },
    ],
    build: (v) => {
      const handle = val(v, 'handle').replace(/^@/, '');
      switch (val(v, 'network')) {
        case 'x': return `https://x.com/${handle}`;
        case 'tiktok': return `https://www.tiktok.com/@${handle}`;
        case 'linkedin': return `https://www.linkedin.com/in/${handle}`;
        case 'youtube': return `https://www.youtube.com/@${handle}`;
        case 'facebook': return `https://www.facebook.com/${handle}`;
        case 'github': return `https://github.com/${handle}`;
        default: return `https://instagram.com/${handle}`;
      }
    },
    summarize: (v) => '@' + val(v, 'handle').replace(/^@/, '') || 'Social',
  },

  {
    id: 'appstore',
    label: 'App',
    blurb: 'Link to an app listing.',
    suggestEc: 'M',
    fields: [
      {
        key: 'store', label: 'Store', type: 'select',
        options: [
          { value: 'ios', label: 'App Store' },
          { value: 'android', label: 'Google Play' },
        ],
      },
      { key: 'id', label: 'App ID', type: 'text', placeholder: '6789685146 or com.example.app' },
    ],
    build: (v) => {
      const id = val(v, 'id');
      return val(v, 'store') === 'android'
        ? `https://play.google.com/store/apps/details?id=${encodeURIComponent(id)}`
        : `https://apps.apple.com/app/id${id.replace(/^id/, '')}`;
    },
    summarize: (v) => val(v, 'id') || 'App',
  },

  {
    id: 'crypto',
    label: 'Crypto',
    blurb: 'A BIP-21 style payment request.',
    suggestEc: 'Q',
    fields: [
      {
        key: 'chain', label: 'Currency', type: 'select',
        options: [
          { value: 'bitcoin', label: 'Bitcoin' },
          { value: 'ethereum', label: 'Ethereum' },
          { value: 'litecoin', label: 'Litecoin' },
          { value: 'dogecoin', label: 'Dogecoin' },
        ],
      },
      { key: 'address', label: 'Address', type: 'text' },
      { key: 'amount', label: 'Amount', type: 'number', optional: true },
      { key: 'label', label: 'Label', type: 'text', optional: true },
    ],
    build: (v) =>
      `${val(v, 'chain') || 'bitcoin'}:${val(v, 'address')}` +
      query([
        ['amount', val(v, 'amount')],
        ['label', val(v, 'label')],
      ]),
    summarize: (v) => val(v, 'label') || val(v, 'address').slice(0, 16) || 'Crypto',
  },

  {
    id: 'raw',
    label: 'Raw',
    blurb: 'Type the payload byte for byte. Nothing is added or escaped.',
    suggestEc: 'M',
    fields: [
      { key: 'raw', label: 'Payload', type: 'multiline', placeholder: 'WIFI:T:WPA;S:...;;' },
    ],
    build: (v) => v.raw ?? '',
    summarize: (v) => val(v, 'raw').split('\n')[0].slice(0, 40) || 'Raw',
  },
];

export function contentTypeById(id: string): ContentTypeDef {
  return CONTENT_TYPES.find((t) => t.id === id) ?? CONTENT_TYPES[0];
}

/* ------------------------------------------------------------------ */
/* Reading a scanned payload back into a friendly description           */
/* ------------------------------------------------------------------ */

export type ParsedPayload = { kind: string; title: string; detail: string; actionUrl?: string };

/**
 * Best-effort classification of scanned content, used by the scanner to show
 * people what a code will actually do before they tap anything.
 */
export function describePayload(text: string): ParsedPayload {
  const t = text.trim();

  if (/^WIFI:/i.test(t)) {
    const ssid = /(?:^|;)S:((?:\\.|[^;\\])*)/i.exec(t)?.[1] ?? '';
    const security = /(?:^|;)T:([^;]*)/i.exec(t)?.[1] ?? 'WPA';
    return {
      kind: 'Wi-Fi network',
      title: ssid.replace(/\\(.)/g, '$1') || 'Wi-Fi',
      detail: security === 'nopass' ? 'Open network' : `${security} secured`,
    };
  }
  if (/^BEGIN:VCARD/i.test(t)) {
    const fn = /(?:^|\n)FN:(.*)/i.exec(t)?.[1] ?? '';
    const tel = /(?:^|\n)TEL[^:]*:(.*)/i.exec(t)?.[1] ?? '';
    return { kind: 'Contact card', title: fn.trim() || 'Contact', detail: tel.trim() };
  }
  if (/^BEGIN:VEVENT/i.test(t)) {
    const summary = /(?:^|\n)SUMMARY:(.*)/i.exec(t)?.[1] ?? '';
    const start = /(?:^|\n)DTSTART[^:]*:(.*)/i.exec(t)?.[1] ?? '';
    return { kind: 'Calendar event', title: summary.trim() || 'Event', detail: start.trim() };
  }
  if (/^mailto:/i.test(t)) {
    return { kind: 'Email', title: t.slice(7).split('?')[0], detail: t, actionUrl: t };
  }
  if (/^(smsto:|sms:)/i.test(t)) {
    const rest = t.replace(/^(smsto:|sms:)/i, '');
    const [num, ...msg] = rest.split(':');
    return { kind: 'Message', title: num, detail: msg.join(':') };
  }
  if (/^tel:/i.test(t)) {
    return { kind: 'Phone number', title: t.slice(4), detail: '', actionUrl: t };
  }
  if (/^geo:/i.test(t)) {
    return { kind: 'Location', title: t.slice(4).split('?')[0], detail: t };
  }
  if (/^https?:\/\//i.test(t)) {
    let host = t;
    try {
      host = new URL(t).host;
    } catch {
      host = t.replace(/^https?:\/\//i, '').split('/')[0];
    }
    return { kind: 'Web link', title: host, detail: t, actionUrl: t };
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) {
    const scheme = t.split(':')[0];
    return { kind: `${scheme} link`, title: t.slice(0, 60), detail: t, actionUrl: t };
  }
  return { kind: 'Text', title: t.split('\n')[0].slice(0, 60) || 'Empty', detail: t };
}
