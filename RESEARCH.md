# What's wrong with QR code apps, and what this one does instead

This is the survey the app was built from: what the market looks like, what
users actually complain about, and which of those complaints are fixable in
software rather than in marketing copy.

## Scope of the survey

Reviewed in August 2026: the top-ranking iOS QR apps and their App Store
listings and review threads; the major web generators (QRCode Monkey, Canva,
Adobe Express, QR.io, Bitly's QR Code Generator, Uniqode, Pageloot); the
comparison round-ups those tools are ranked in; Trustpilot and Product Hunt
threads for the paid services; and the underlying standards and reference
implementations (ISO/IEC 18004, the ZXing "Barcode Contents" conventions,
Nayuki's reference encoder, the `qrcode` npm package, ZXing-JS, jsQR).

This is not a claim to have used every QR tool that exists. It is a claim to
have read the ones people actually rank, and their complaint threads, closely
enough to find the recurring failures.

## What the market gets wrong

### 1. The subscription trap on "dynamic" codes

The single loudest complaint, and the most damaging. A dynamic QR code is a
short redirect URL owned by the vendor. It is genuinely useful — you can edit
the destination after printing, and you get scan analytics. It is also a
kill switch. Users report printing business cards, menus and signage, then
finding the codes dead when a trial lapsed or a plan was cancelled, with
recurring fees of $40/month or $350/year quoted to bring them back. Several
report being locked out of the billing settings while charges continued.

Static codes have no such failure mode: the content is encoded in the pattern
itself, so the code works forever, offline, with nobody's server involved.

**Decision:** QR Forge produces static codes only, and says so plainly. There
is no vendor in the loop that could ever switch a printed code off. The cost
is real and worth naming: no analytics, and no editing a destination after
printing. If you need those, you need a redirect service, and you should pick
one knowing it is a permanent dependency.

### 2. Dark-pattern pricing on the App Store side

The most-installed iOS QR apps are free downloads wrapped around aggressive
subscriptions — tiers from $2.99 to $29.99, with weekly billing common. Review
threads describe trials that activate on launch without a clear decline path,
difficulty cancelling, and full-screen interstitials shown in place of the
scan result. One of the top-rated apps in the category carries 669K ratings
and, simultaneously, a steady stream of one-star reviews calling the pricing
deceptive.

**Decision:** no subscriptions, no in-app purchases, no ads, no analytics, no
account. Nothing to cancel and nothing to decline.

### 3. Nobody checks whether the styled code still scans

This is the gap the whole app is built around.

Every serious generator now offers rounded modules, custom corner "eyes",
gradients and a centre logo. None of the tools surveyed verify the result.
They apply the styling and hand you a PNG. The guidance offered instead is
rules of thumb — "level H recovers 30%, so keep the logo under 25%", "never
cover the corner squares" — which are correct on average and useless in the
specific case, because whether a *particular* code survives a *particular*
logo at a *particular* error-correction level is a question with an exact
answer that nobody computes.

The failure is expensive and silent. You find out at the print shop, or worse,
from a customer standing in front of a sign that will not scan.

**Decision:** the app decodes its own artwork before you get it. See
[README](README.md#the-scan-check) for how, and for the measurements.

### 4. Escaping bugs in the payload formats

Wi-Fi and MeCard payloads use `;` and `:` as delimiters and require
backslash-escaping of `\ ; , " :` inside values. vCard 3.0 needs a different
escape set. A Wi-Fi password containing a semicolon, or a contact name with a
comma, silently produces a broken code in tools that concatenate strings
without escaping. This is easy to get wrong and easy to not notice, because
the code still *scans* — it just yields the wrong data.

**Decision:** each payload builder escapes to the convention readers actually
implement, and the round-trip check catches the cases where it does not,
because the app compares the decoded output against the exact input string.

### 5. Everything else worth keeping

The good ideas in the category, which this app also does: many content types
rather than URL-only; vector export for print; a scan history; a scanner that
shows the destination URL before opening it (the safety feature reviewers
single out most often, and the answer to sticker-over-sticker "quishing").

## What was deliberately left out

- **Dynamic codes and analytics.** Covered above: they require a server, and
  the server is the failure mode.
- **Kanji mode.** ISO/IEC 18004 defines a fourth encoding mode that packs
  Shift-JIS characters into 13 bits. It needs a ~7,000-entry mapping table and
  only helps density for Japanese text — which byte mode already encodes
  correctly via UTF-8, just less compactly. Not worth the bundle size.
- **Other symbologies.** Data Matrix, Aztec, PDF417 and the 1D barcodes are a
  different standard each. This app does one thing.
- **iPad.** The layout is designed for one hand on a phone. Shipping a
  stretched phone UI on a 13-inch screen would be worse than not shipping it.

## Sources

- [Best QR Code Generators for iPhone — SourceForge](https://sourceforge.net/software/qr-code-generators/iphone/)
- [The Best QR Code Scanning Apps in 2026 — Pageloot](https://pageloot.com/blog/best-qr-code-scanning-apps-comparison/)
- [10 Best QR Code Scanner Apps — Uniqode](https://www.uniqode.com/blog/qr-code-basics/best-qr-code-scanner-apps)
- [Best QR Code Generators of 2026 — TrueQRCode](https://trueqrcode.com/blog/best-qr-code-generators/)
- [QR Code Reader — App Store listing and reviews](https://apps.apple.com/us/app/qr-code-reader/id1200318119)
- [QRbot — QR code and barcode scanner](https://qrbot.net/)
- [You (Probably) Shouldn't Pay For QR Codes — Wilkinson.Graphics](https://wilkinson.graphics/blog/2025-07-15-qr-code-scam/)
- [QRCG by Bitly — Trustpilot reviews](https://www.trustpilot.com/review/www.qr-code-generator.com)
- [QR.io — Trustpilot reviews](https://www.trustpilot.com/review/qr.io)
- [Banned Scanner App Back On App Store — Forbes](https://www.forbes.com/sites/johnkoetsier/2018/10/19/banned-scam-app-immediately-back-on-app-store-now-charging-immediately-for-free-trial/)
- [Barcode Contents — ZXing wiki](https://github.com/zxing/zxing/wiki/Barcode-Contents)
- [ISO/IEC 18004: The QR Code Standard, Explained — QRLynx](https://qrlynx.com/blog/iso-iec-18004-qr-code-standard-explained)
- [QR Code Internals: Masking, Reed-Solomon, and the Scanner Pipeline — QubitTool](https://qubittool.com/blog/qrcode-complete-guide)
- [Guidelines for Adding a Logo to a QR Code — Pageloot](https://pageloot.com/blog/how-to-add-logos-to-qr-codes/)
- [QR Code Logo Placement: Size Rules — Super QR Code Generator](https://www.super-qr-code-generator.com/en/blog/qr-code-logo-placement-size-rules)
- [MeCard — Wikipedia](https://en.wikipedia.org/wiki/MeCard_(QR_code))
- [vCard — Wikipedia](https://en.wikipedia.org/wiki/VCard)
