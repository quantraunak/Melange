import { describe, expect, it } from "vitest";

import { normalizeHandle } from "@/app/lib/publicData";
import { SCENES, sceneLabel } from "@/app/lib/scenes";

describe("public profile handles", () => {
  it("accepts what /@handle sends, in any case, with or without the @", () => {
    expect(normalizeHandle("jane.doe")).toBe("jane.doe");
    expect(normalizeHandle("@Jane_Doe")).toBe("jane_doe");
    expect(normalizeHandle("%40jane")).toBe("jane");
  });

  it("rejects anything the database CHECK would reject, without calling it", () => {
    expect(normalizeHandle("ab")).toBeNull();
    expect(normalizeHandle("has space")).toBeNull();
    expect(normalizeHandle("a".repeat(31))).toBeNull();
    expect(normalizeHandle("%E0%A4%A")).toBeNull();
  });
});

describe("scenes", () => {
  it("matches the scene ids the database allows", () => {
    expect(SCENES.map((s) => s.id)).toEqual(["usc", "ucsd", "la", "nyc"]);
    expect(sceneLabel("ucsd")).toBe("UCSD");
    expect(sceneLabel("nowhere")).toBeNull();
    expect(sceneLabel(null)).toBeNull();
  });
});
