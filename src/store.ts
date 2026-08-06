import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RenderStyle } from './qr/render';
import type { EcLevel } from './qr/spec';
import type { Values } from './qr/payloads';

const HISTORY_KEY = 'qrforge.library.v1';
const SETTINGS_KEY = 'qrforge.settings.v1';
const MAX_ITEMS = 300;

export type LibraryItem = {
  id: string;
  createdAt: number;
  source: 'created' | 'scanned';
  typeId: string;
  values: Values;
  payload: string;
  style: Partial<RenderStyle>;
  ecLevel: EcLevel;
  title: string;
  subtitle: string;
  favourite: boolean;
  grade?: string;
};

export type Settings = {
  theme: 'system' | 'dark' | 'light';
  haptics: boolean;
  saveToLibrary: boolean;
  defaultEcLevel: EcLevel;
  /** Export size in pixels for PNG. */
  exportSize: number;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  haptics: true,
  saveToLibrary: true,
  defaultEcLevel: 'Q',
  exportSize: 2048,
};

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function loadLibrary(): Promise<LibraryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveLibrary(items: LibraryItem[]): Promise<void> {
  try {
    // Favourites are never trimmed away.
    const favourites = items.filter((i) => i.favourite);
    const rest = items.filter((i) => !i.favourite).slice(0, MAX_ITEMS - favourites.length);
    const merged = [...items.filter((i) => favourites.includes(i) || rest.includes(i))];
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(merged));
  } catch {
    // A full disk should not take the app down; the code on screen still works.
  }
}

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
