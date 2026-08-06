import React, { forwardRef, useMemo } from 'react';
import Svg, {
  ClipPath,
  Defs,
  Image as SvgImage,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Circle,
} from 'react-native-svg';
import { GRADIENT_ID, artworkToPathGroups, gradientGeometry } from '../qr/render';
import type { Artwork } from '../qr/render';

type Props = {
  artwork: Artwork;
  /** On-screen or export width in points/pixels. */
  size: number;
  /** Drop the background rectangle, for a transparent PNG export. */
  transparent?: boolean;
};

const LOGO_CLIP = 'qrLogoClip';

/**
 * Draws an Artwork with react-native-svg.
 *
 * It consumes exactly the same path groups as the SVG file exporter, so the
 * preview, the shared PNG, the vector file and the verified geometry are all
 * the same drawing. A ref gives access to `toDataURL` for PNG export, which
 * is why this is a real Svg element tree rather than a parsed XML string.
 */
export const QrCanvas = forwardRef<Svg, Props>(function QrCanvas(
  { artwork, size, transparent = false },
  ref,
) {
  const groups = useMemo(() => artworkToPathGroups(artwork), [artwork]);
  const extent = artwork.extent;
  const gradient = artwork.gradient;
  const logoBox = artwork.logoBox;
  const logoHref = artwork.logo?.href;

  return (
    <Svg ref={ref} width={size} height={size} viewBox={`0 0 ${extent} ${extent}`}>
      {(gradient || (logoBox && artwork.logo?.shape === 'circle')) && (
        <Defs>
          {gradient?.type === 'linear' && (
            <LinearGradient id={GRADIENT_ID} gradientUnits="userSpaceOnUse" {...gradientGeometry(gradient, extent)}>
              {gradient.stops.map((s, i) => (
                <Stop key={i} offset={s.offset} stopColor={s.color} />
              ))}
            </LinearGradient>
          )}
          {gradient?.type === 'radial' && (
            <RadialGradient id={GRADIENT_ID} cx="50%" cy="50%" r="70%">
              {gradient.stops.map((s, i) => (
                <Stop key={i} offset={s.offset} stopColor={s.color} />
              ))}
            </RadialGradient>
          )}
          {logoBox && artwork.logo?.shape === 'circle' && (
            <ClipPath id={LOGO_CLIP}>
              <Circle cx={logoBox.x + logoBox.w / 2} cy={logoBox.y + logoBox.h / 2} r={logoBox.w / 2} />
            </ClipPath>
          )}
        </Defs>
      )}

      {!transparent && artwork.background !== 'transparent' && (
        <Rect
          x={0}
          y={0}
          width={extent}
          height={extent}
          rx={artwork.style.backgroundRadius}
          ry={artwork.style.backgroundRadius}
          fill={artwork.background}
        />
      )}

      {groups.map((g, i) => (
        <Path key={i} d={g.d} fill={g.fill} />
      ))}

      {logoBox && logoHref && (
        <SvgImage
          href={{ uri: logoHref }}
          x={logoBox.x}
          y={logoBox.y}
          width={logoBox.w}
          height={logoBox.h}
          preserveAspectRatio="xMidYMid slice"
          clipPath={artwork.logo?.shape === 'circle' ? `url(#${LOGO_CLIP})` : undefined}
        />
      )}
    </Svg>
  );
});
