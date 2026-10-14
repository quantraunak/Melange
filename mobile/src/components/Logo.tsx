import Svg, { Circle, Path } from "react-native-svg";

/**
 * The Melange mark, as Raunak drew it: a four-point star inside a ring, with a
 * violet centre.
 *
 * It is deliberately NOT derived from the theme tokens. These are the exact
 * colours of the artwork he sent, and a mark that shifts when someone retunes
 * the palette is not a mark. The one place they appear is here.
 *
 * It carries its own light disc, so it reads on the white app surfaces and on
 * the brand indigo of the auth screens without needing a second palette.
 */
const R = 37;
const I = 14;
const STAR =
  `M50,${50 - R} Q${50 + I},${50 - I} ${50 + R},50 ` +
  `Q${50 + I},${50 + I} 50,${50 + R} ` +
  `Q${50 - I},${50 + I} ${50 - R},50 ` +
  `Q${50 - I},${50 - I} 50,${50 - R} Z`;

const LINE = "#2a44bd";
const RING = "#e3edfa";
const FILL = "#c4d4f6";
const CENTRE = "#3f2496";

export function Logo({ size = 36 }: { size?: number }) {
  // Strokes are given in viewBox units, so they scale with `size` rather than
  // thinning out as the mark grows.
  const sw = 2;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={40} fill={RING} stroke={LINE} strokeWidth={sw} />
      <Path d={STAR} fill={FILL} stroke={LINE} strokeWidth={sw} strokeLinejoin="round" />
      <Circle cx={50} cy={50} r={8} fill={CENTRE} />
    </Svg>
  );
}
