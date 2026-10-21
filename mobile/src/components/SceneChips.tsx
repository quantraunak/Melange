import { Chip, ChipRow } from "@/components/ui/Chip";
import { SCENES, type Scene } from "@/lib/scenes";

/**
 * USC · UCSD · LA · NYC as a single-choice chip row.
 *
 * `allLabel` adds a leading "All" chip whose value is null (Explore, Nights).
 * `otherLabel` adds a trailing chip whose value is "other" (the waitlist,
 * where "none of these" is a real answer).
 */
export function SceneChips<T extends Scene | "other" | null>({
  value,
  onChange,
  allLabel,
  otherLabel,
  disabled,
}: {
  value: T;
  onChange: (next: T) => void;
  allLabel?: string;
  otherLabel?: string;
  disabled?: boolean;
}) {
  const pick = (v: T) => {
    if (!disabled) onChange(v);
  };
  return (
    <ChipRow>
      {allLabel ? (
        <Chip label={allLabel} selected={value === null} onPress={() => pick(null as T)} />
      ) : null}
      {SCENES.map((s) => (
        <Chip key={s.id} label={s.label} selected={value === s.id} onPress={() => pick(s.id as T)} />
      ))}
      {otherLabel ? (
        <Chip label={otherLabel} selected={value === "other"} onPress={() => pick("other" as T)} />
      ) : null}
    </ChipRow>
  );
}
