import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@/lib/theme";

export function Logo({ size = 36, stroke = colors.brand }: { size?: number; stroke?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx="50" cy="50" r="48" fill="#E0F2FE" stroke={stroke} strokeWidth={2} />
      <Path
        d="M50 10C55 25 75 40 90 50C75 60 55 75 50 90C45 75 25 60 10 50C25 40 45 25 50 10Z"
        fill="#BFDBFE"
        stroke={stroke}
        strokeWidth={2}
      />
      <Circle cx="50" cy="50" r="10" fill={stroke} />
    </Svg>
  );
}
