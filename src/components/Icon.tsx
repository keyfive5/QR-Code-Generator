import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'create'
  | 'scan'
  | 'library'
  | 'settings'
  | 'share'
  | 'save'
  | 'copy'
  | 'check'
  | 'warning'
  | 'close'
  | 'chevronRight'
  | 'chevronDown'
  | 'design'
  | 'image'
  | 'trash'
  | 'shield'
  | 'plus'
  | 'flash'
  | 'info';

type Props = {
  name: IconName;
  size?: number;
  color: string;
  /** Filled icons read better in the tab bar at small sizes. */
  filled?: boolean;
};

/**
 * A small hand-drawn icon set. Bundling an icon font for eighteen glyphs
 * would cost more download than the whole engine.
 */
export function Icon({ name, size = 22, color, filled = false }: Props) {
  const s = { stroke: color, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'create' && (
        <>
          <Rect x={3} y={3} width={7} height={7} rx={1.6} {...s} fill={filled ? color : 'none'} />
          <Rect x={14} y={3} width={7} height={7} rx={1.6} {...s} />
          <Rect x={3} y={14} width={7} height={7} rx={1.6} {...s} />
          <Path d="M14 14h3v3h-3zM18.5 18.5H21V21h-2.5zM14 19.5h1.5M19.5 14H21" {...s} />
        </>
      )}
      {name === 'scan' && (
        <>
          <Path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" {...s} />
          <Path d="M3.5 12h17" {...s} strokeWidth={1.9} />
        </>
      )}
      {name === 'library' && (
        <>
          <Rect x={3} y={4} width={18} height={16} rx={2.4} {...s} />
          <Path d="M3 9h18M8.5 9v11" {...s} />
        </>
      )}
      {name === 'settings' && (
        <>
          <Circle cx={12} cy={12} r={3} {...s} />
          <Path d="M12 2.6v2.2M12 19.2v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.4 19.6L6 18M18 6l1.6-1.6" {...s} />
        </>
      )}
      {name === 'share' && (
        <Path d="M12 15V3.5M12 3.5 8.5 7M12 3.5 15.5 7M5 12.5v6A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5v-6" {...s} />
      )}
      {name === 'save' && (
        <Path d="M12 3.5v11M12 14.5 8.5 11M12 14.5 15.5 11M5 15.5v3A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5v-3" {...s} />
      )}
      {name === 'copy' && (
        <>
          <Rect x={8.5} y={8.5} width={12} height={12} rx={2.2} {...s} />
          <Path d="M15.5 5.5A2 2 0 0 0 13.5 3.5h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2" {...s} />
        </>
      )}
      {name === 'check' && <Path d="M4.5 12.5 9.5 17.5 19.5 6.5" {...s} strokeWidth={2.2} />}
      {name === 'warning' && (
        <>
          <Path d="M12 4.5 21 19.5H3z" {...s} />
          <Path d="M12 10v4" {...s} strokeWidth={2} />
          <Circle cx={12} cy={16.8} r={0.9} fill={color} stroke="none" />
        </>
      )}
      {name === 'close' && <Path d="M6 6l12 12M18 6L6 18" {...s} strokeWidth={2} />}
      {name === 'chevronRight' && <Path d="M9.5 5l7 7-7 7" {...s} strokeWidth={2} />}
      {name === 'chevronDown' && <Path d="M5 9.5l7 7 7-7" {...s} strokeWidth={2} />}
      {name === 'design' && (
        <>
          <Path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h10M18 17h2" {...s} />
          <Circle cx={16} cy={7} r={2.1} {...s} />
          <Circle cx={10} cy={12} r={2.1} {...s} />
          <Circle cx={16} cy={17} r={2.1} {...s} />
        </>
      )}
      {name === 'image' && (
        <>
          <Rect x={3} y={4.5} width={18} height={15} rx={2.4} {...s} />
          <Circle cx={8.5} cy={9.5} r={1.6} {...s} />
          <Path d="M3.5 16.5 9 11.5l4 3.6 3-2.4 4.5 3.8" {...s} />
        </>
      )}
      {name === 'trash' && (
        <Path d="M4.5 6.5h15M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7M6.5 6.5l.9 12.2a2 2 0 0 0 2 1.8h5.2a2 2 0 0 0 2-1.8l.9-12.2M10.5 10.5v6M13.5 10.5v6" {...s} />
      )}
      {name === 'shield' && (
        <>
          <Path d="M12 2.8 20 5.6v6c0 4.6-3.2 8.2-8 9.6-4.8-1.4-8-5-8-9.6v-6z" {...s} />
          <Path d="M8.6 12.1 11 14.5l4.6-4.8" {...s} strokeWidth={2} />
        </>
      )}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...s} strokeWidth={2} />}
      {name === 'flash' && <Path d="M13.5 2.5 5 13.5h5.5L10 21.5 19 10.5h-5.5z" {...s} />}
      {name === 'info' && (
        <>
          <Circle cx={12} cy={12} r={9} {...s} />
          <Path d="M12 11v5.5" {...s} strokeWidth={2} />
          <Circle cx={12} cy={7.9} r={1} fill={color} stroke="none" />
        </>
      )}
    </Svg>
  );
}
