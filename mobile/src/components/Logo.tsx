import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@/lib/theme";

/**
 * Two overlapping circles, with the overlap in the accent.
 *
 * The previous mark was a four-point sparkle inside a circle inside a square,
 * with a dot in the middle. Three nested shapes that meant nothing, and the
 * sparkle is the single most overused symbol in software right now: it reads
 * as a generic AI feature, which is the opposite of what this app is. It also
 * failed at tab-bar size, where the thin strokes dissolved into pale blue mush.
 *
 * Two circles say what the product is. Melange means a mixture, and the thing
 * worth having is what two people make together, not either of them alone. The
 * overlap is violet rather than a blend of the two blues on purpose: a
 * collaboration produces a third thing neither one would have made.
 *
 * No strokes anywhere, so it holds together down to about sixteen points.
 */
const R = 27;
const C1 = 35;
const C2 = 65;
const DY = Math.sqrt(R * R - ((C2 - C1) / 2) ** 2);
const LENS = `M50 ${50 - DY} A${R} ${R} 0 0 1 50 ${50 + DY} A${R} ${R} 0 0 1 50 ${50 - DY} Z`;

/**
 * Two palettes, because the auth screens sit on the brand indigo and the deep
 * circle would vanish into it. On that ground the values invert and the
 * overlap lifts to violet-400, which is the lightest thing in the mark rather
 * than the darkest.
 */
const TONES = {
  brand: { left: colors.brand, right: colors.brandText, overlap: colors.accent },
  onBrand: { left: colors.onBrandMuted, right: colors.white, overlap: "#a78bfa" },
} as const;

export function Logo({
  size = 36,
  tone = "brand",
}: {
  size?: number;
  tone?: keyof typeof TONES;
}) {
  const c = TONES[tone];
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={C1} cy={50} r={R} fill={c.left} />
      <Circle cx={C2} cy={50} r={R} fill={c.right} />
      <Path d={LENS} fill={c.overlap} />
    </Svg>
  );
}
