import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as Clipboard from 'expo-clipboard';
import { artworkToSvg } from './qr/render';
import type { Artwork } from './qr/render';

export type ExportFormat = 'png' | 'svg' | 'pdf';

function safeName(title: string): string {
  const base = title
    .replace(/[^a-z0-9 _-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
  return base || 'qr-code';
}

/** Writes to the cache directory, replacing any previous file of that name. */
function writeCacheFile(name: string, data: string, base64: boolean): string {
  const file = new File(Paths.cache, name);
  try {
    if (file.exists) file.delete();
  } catch {
    /* a stale handle is not worth failing the export over */
  }
  file.create();
  file.write(data, base64 ? { encoding: 'base64' } : undefined);
  return file.uri;
}

/**
 * Asks react-native-svg for a PNG of the live element tree. Using the same
 * element tree as the preview is the point: the exported pixels come from the
 * drawing that was verified, not a re-render that might differ.
 */
export function svgToPngBase64(
  ref: { toDataURL?: (cb: (data: string) => void, options?: object) => void } | null,
  size: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ref?.toDataURL) {
      reject(new Error('The preview is not ready yet.'));
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Rendering the image took too long.'));
      }
    }, 15000);
    ref.toDataURL(
      (data) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(data.replace(/^data:image\/png;base64,/, ''));
      },
      { width: size, height: size },
    );
  });
}

export async function buildExportFile(
  format: ExportFormat,
  art: Artwork,
  title: string,
  pngBase64: string | null,
  pixelSize: number,
): Promise<{ uri: string; mimeType: string; uti: string }> {
  const name = safeName(title);

  if (format === 'svg') {
    const svg = artworkToSvg(art, { pixelSize });
    return {
      uri: writeCacheFile(`${name}.svg`, svg, false),
      mimeType: 'image/svg+xml',
      uti: 'public.svg-image',
    };
  }

  if (format === 'pdf') {
    // The SVG goes into the PDF as vector art, so it stays sharp at any print
    // size — which is the whole reason someone exports a QR code as a PDF.
    const svg = artworkToSvg(art);
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      @page { margin: 0; }
      html,body { margin:0; padding:0; height:100%; }
      .wrap { display:flex; align-items:center; justify-content:center; height:100%; }
      svg { width: 6in; height: 6in; }
    </style></head><body><div class="wrap">${svg}</div></body></html>`;
    const { uri } = await Print.printToFileAsync({ html, width: 612, height: 612 });
    return { uri, mimeType: 'application/pdf', uti: 'com.adobe.pdf' };
  }

  if (!pngBase64) throw new Error('The image is not ready yet.');
  return {
    uri: writeCacheFile(`${name}.png`, pngBase64, true),
    mimeType: 'image/png',
    uti: 'public.png',
  };
}

export async function shareFile(file: { uri: string; mimeType: string; uti: string }): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: file.mimeType,
    UTI: file.uti,
    dialogTitle: 'Share QR code',
  });
}

type MediaLibraryModule = {
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  Asset?: { create?: (uri: string) => Promise<unknown> };
  createAssetAsync?: (uri: string) => Promise<unknown>;
};

export async function saveImageToPhotos(uri: string): Promise<void> {
  // Loaded on demand: the photo-library native module does not exist on web,
  // and importing it at the top of the file takes the whole bundle down there.
  let MediaLibrary: MediaLibraryModule;
  try {
    MediaLibrary = require('expo-media-library') as MediaLibraryModule;
  } catch {
    throw new Error('Saving to Photos is not supported on this device.');
  }

  const permission = await MediaLibrary.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error('QR Forge needs permission to add photos to your library.');
  }
  // The save API was renamed in SDK 54; support both so the app keeps working
  // across Expo upgrades.
  if (MediaLibrary.Asset?.create) await MediaLibrary.Asset.create(uri);
  else if (MediaLibrary.createAssetAsync) await MediaLibrary.createAssetAsync(uri);
  else throw new Error('Saving to Photos is not supported on this device.');
}

export async function copyText(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
}
