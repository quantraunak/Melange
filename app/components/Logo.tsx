export default function Logo({
  size = "md",
  stroke = "#1E40AF",
  center = "#4C1D95",
}: {
  size?: "sm" | "md" | "lg";
  stroke?: string;
  center?: string;
}) {
  const cls =
    size === "sm" ? "h-8 w-8" : size === "lg" ? "h-16 w-16" : "h-10 w-10";
  return (
    <svg className={cls} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="48" fill="#E0F2FE" stroke={stroke} strokeWidth="2" />
      <path
        d="M50 10C55 25 75 40 90 50C75 60 55 75 50 90C45 75 25 60 10 50C25 40 45 25 50 10Z"
        fill="#BFDBFE"
        stroke={stroke}
        strokeWidth="2"
      />
      <circle cx="50" cy="50" r="10" fill={center} />
    </svg>
  );
}
