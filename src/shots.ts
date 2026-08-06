/**
 * Deterministic preview states, driven by a `?shot=` query parameter.
 *
 * Only ever reachable on web, where the app runs for visual review and for
 * capturing store screenshots. On a device there is no query string, so none
 * of this executes.
 */
import { Platform } from 'react-native';
import type { RenderStyle } from './qr/render';
import type { EcLevel } from './qr/spec';
import type { Values } from './qr/payloads';
import type { LibraryItem } from './store';
import { PRESETS } from './presets';

export type ShotState = {
  tab?: 'create' | 'scan' | 'library';
  typeId?: string;
  values?: Record<string, Values>;
  style?: Partial<RenderStyle>;
  ecLevel?: EcLevel;
  openDesign?: boolean;
  expandHealth?: boolean;
  library?: LibraryItem[];
};

function preset(id: string): Partial<RenderStyle> {
  return PRESETS.find((p) => p.id === id)?.style ?? {};
}

function item(
  id: string,
  title: string,
  subtitle: string,
  payload: string,
  styleId: string,
  ageMinutes: number,
  favourite = false,
  source: 'created' | 'scanned' = 'created',
): LibraryItem {
  return {
    id,
    createdAt: Date.now() - ageMinutes * 60000,
    source,
    typeId: 'raw',
    values: { raw: payload },
    payload,
    style: preset(styleId),
    ecLevel: 'Q',
    title,
    subtitle,
    favourite,
  };
}

const SHOTS: Record<string, ShotState> = {
  '1': {
    tab: 'create',
    typeId: 'link',
    values: { link: { url: 'qrforge.app/spring-menu' } },
    style: preset('dusk'),
    ecLevel: 'Q',
  },
  '2': {
    tab: 'create',
    typeId: 'link',
    values: { link: { url: 'qrforge.app/spring-menu' } },
    style: preset('dusk'),
    ecLevel: 'Q',
    expandHealth: true,
  },
  '3': {
    tab: 'create',
    typeId: 'link',
    values: { link: { url: 'qrforge.app/spring-menu' } },
    style: preset('ember'),
    ecLevel: 'Q',
    openDesign: true,
  },
  '4': {
    tab: 'create',
    typeId: 'wifi',
    values: { wifi: { ssid: 'Studio Guest', security: 'WPA', password: 'welcome-2026' } },
    style: preset('forest'),
    ecLevel: 'Q',
  },
  '5': {
    tab: 'library',
    library: [
      item('a', 'qrforge.app/spring-menu', 'Link', 'https://qrforge.app/spring-menu', 'dusk', 4, true),
      item('b', 'Studio Guest', 'Wi-Fi', 'WIFI:T:WPA;S:Studio Guest;P:welcome-2026;;', 'forest', 52),
      item('c', 'Hasan Zafar', 'Contact', 'BEGIN:VCARD\nVERSION:3.0\nFN:Hasan Zafar\nTEL:+14165550123\nEND:VCARD', 'ink', 190, true),
      item('d', 'instagram.com/qrforge', 'Social', 'https://instagram.com/qrforge', 'sunset', 1500),
      item('e', 'Studio open house', 'Event', 'BEGIN:VEVENT\nSUMMARY:Studio open house\nDTSTART:20260912T180000\nEND:VEVENT', 'graphite', 2900),
      item('f', 'example.com/promo', 'Web link', 'https://example.com/promo', 'classic', 4300, false, 'scanned'),
    ],
  },
};

export function currentShot(): ShotState | null {
  if (Platform.OS !== 'web' || typeof location === 'undefined') return null;
  const key = new URLSearchParams(location.search).get('shot');
  return key ? (SHOTS[key] ?? null) : null;
}
