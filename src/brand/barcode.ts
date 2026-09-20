/**
 * The reference strip.
 *
 * A decorative bar strip derived from the proposal reference, in the style of
 * the Taajeel reference material: variable-width vertical bars in the brand
 * colours. It carries no data and scans as nothing. Its only job is to make two
 * proposals look like two proposals rather than one template run twice, and to
 * give the cover a mark that belongs to *this* document.
 *
 * Pure. Deterministic. No dependencies, no I/O, no network. The same reference
 * always yields byte-identical SVG, which is what lets the golden fixture be a
 * fixture at all.
 */

/** FNV-1a, 32-bit. Chosen because it is four lines and has no surprises. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** xorshift32. Seeded from the hash; never zero, or it degenerates to zero. */
function prng(seed: number): () => number {
  let x = seed || 0x9e3779b9;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 0x100000000;
  };
}

/**
 * The colour ramp, as token names rather than hex literals — the strip has to
 * survive a change to brand/tokens.css the same way everything else in the deck
 * does. Weighted: the strip should read as green with navy punctuation, not as
 * a fruit salad.
 */
const COVER_RAMP = [
  'var(--ss-green)',
  'var(--ss-green)',
  'var(--ss-green)',
  'var(--ss-green-deep)',
  'var(--ss-green-deep)',
  'var(--ss-cream)',
  'var(--ss-navy-raised)',
];

/** Bar widths in grid units. The repetition is the weighting. */
const WIDTHS = [1, 1, 1, 2, 2, 3, 5];

export interface BarcodeOptions {
  /** Rendered width in px. Default 330, which matches the cover lockup. */
  width?: number;
  /** Rendered height in px. Default 26. */
  height?: number;
  /** One ink instead of the ramp, taken from `currentColor`. For the footer. */
  mono?: boolean;
  /** Number of bars. Default 44 on the cover, 18 in mono. */
  bars?: number;
  /** Accessible label. Empty string marks the strip decorative (aria-hidden). */
  label?: string;
}

/**
 * Inline SVG for the strip. Returns a complete `<svg>` element as a string,
 * ready to drop into the page — no external file, so the deck stays a single
 * self-contained document that Playwright can open offline.
 */
export function barcodeSvg(reference: string, opts: BarcodeOptions = {}): string {
  const mono = opts.mono ?? false;
  const width = opts.width ?? (mono ? 92 : 330);
  const height = opts.height ?? (mono ? 13 : 26);
  const count = Math.max(4, opts.bars ?? (mono ? 18 : 44));
  const label = opts.label ?? '';

  const rand = prng(hash32(String(reference ?? '')));

  /* Lay the bars out in abstract units first, then scale the whole run to the
     requested width. Doing it this way means the strip always fills its box
     exactly, whatever widths the reference happened to draw. */
  const units: number[] = [];
  const gap = mono ? 0.7 : 0.9;
  let total = 0;
  for (let i = 0; i < count; i++) {
    const w = WIDTHS[Math.floor(rand() * WIDTHS.length)];
    units.push(w);
    total += w + gap;
  }
  total -= gap;

  const k = width / total;
  let x = 0;
  const bars: string[] = [];
  for (let i = 0; i < count; i++) {
    const w = units[i] * k;
    const fill = mono ? 'currentColor' : COVER_RAMP[Math.floor(rand() * COVER_RAMP.length)];
    /* A few bars in the coloured strip are short, which is what stops it
       reading as a progress bar. The mono footer variant stays flush. */
    const short = !mono && rand() < 0.22;
    const h = short ? height * 0.55 : height;
    bars.push(
      `<rect x="${round(x)}" y="${round(height - h)}" width="${round(w)}" height="${round(h)}" fill="${fill}"/>`
    );
    x += w + gap * k;
  }

  const a11y = label
    ? ` role="img" aria-label="${label.replace(/"/g, '&quot;')}"`
    : ' aria-hidden="true" focusable="false"';

  return (
    `<svg class="barcode${mono ? ' barcode-mono' : ''}" width="${round(width)}" height="${round(height)}" ` +
    `viewBox="0 0 ${round(width)} ${round(height)}" xmlns="http://www.w3.org/2000/svg"${a11y}>` +
    bars.join('') +
    `</svg>`
  );
}

/** Two decimals is well under a device pixel at this size, and keeps the SVG short. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
