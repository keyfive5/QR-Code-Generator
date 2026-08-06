// All App Store listing copy in one place, so it is reviewable in the repo
// rather than living only in a web form.
//
// House rules learned the hard way: guideline 2.3.7 rejects price references
// in the subtitle and promotional text, so "free" appears only in the
// description, where Apple allows it.

export const NAME = 'QR Forge — Code Generator';

export const SUBTITLE = 'Every code checked. Offline.';

export const PROMOTIONAL_TEXT =
  'Most QR apps draw a code and hope. QR Forge reads its own artwork back ' +
  'through a full decode before you export it, so you know it scans before ' +
  'you print it.';

export const KEYWORDS =
  'qr,qr code,generator,maker,creator,scanner,wifi,vcard,barcode,logo,offline,svg,vector,business';

export const SUPPORT_URL = 'https://github.com/keyfive5/QR-Code-Generator';
export const MARKETING_URL = 'https://github.com/keyfive5/QR-Code-Generator';
export const PRIVACY_URL = 'https://github.com/keyfive5/QR-Code-Generator#privacy';
export const COPYRIGHT = '2026 Hasan Zafar';

export const DESCRIPTION = `QR Forge makes QR codes — and then proves they work.

Every other generator draws your code and hands it over. QR Forge reads its own work back first. After the artwork is rendered — rounded modules, a gradient, your logo through the middle — the app samples that finished drawing the way a camera does and runs it through a complete Reed-Solomon decode. If your content doesn't come back exactly as you typed it, you are told before you export anything.

You get numbers, not a badge:

• Whether the code decoded back to your exact content
• How much of the error-correction budget your styling spent
• How it holds up across five off-centre reads, the way a phone sees a code photographed at an angle
• Mark strength, contrast ratio, quiet zone and logo coverage
• The smallest size you can safely print it

FOURTEEN KINDS OF CODE

Link, Text, Wi-Fi, Contact card, Email, Message, Phone, Location, Calendar event, WhatsApp, Social profile, App listing, Crypto payment, and Raw for typing a payload byte for byte.

Wi-Fi passwords and contact names containing punctuation are escaped correctly — a detail that quietly breaks codes in a lot of tools, because the code still scans, it just carries the wrong data.

DESIGN THAT STILL SCANS

Six module shapes, five corner frames, five corner centres, linear and radial gradients, adjustable module spacing and quiet zone, and a centre logo with a padding ring. Ten presets, every one of them covered by the project's test suite.

Tap "fit the largest logo that still scans" and the app searches for the biggest logo your specific code can carry, checking each size against the decoder — not against a generic rule of thumb.

EXPORT PROPERLY

PNG at up to 4096 pixels, plus SVG and vector PDF that stay sharp at any print size. Every format included.

A SCANNER THAT WARNS YOU

Point it at a code and see exactly where it leads before anything opens. That is the answer to a sticker pasted over a real one.

NO CATCH

Free, with no subscription, no in-app purchases, no ads, no account and no analytics. The app makes no network requests of any kind — there is no code in it that could send your data anywhere. Your library and your logo images stay on your phone.

Your codes are static, which means the content is encoded in the pattern itself. They work forever, they work offline, and nobody can switch them off, redirect them, or move them behind a paywall later.

OPEN SOURCE

The encoder, the scan checker and the test suite behind all of this are public at github.com/keyfive5/QR-Code-Generator

QR Code is a registered trademark of Denso Wave Incorporated.`;

export const WHATS_NEW = 'First release.';

/** Caption order matches store/screenshots/<size>-<n>.png */
export const SCREENSHOT_ORDER = ['1', '2', '3', '4', '5'];
