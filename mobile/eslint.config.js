const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  ...expoConfig,
  {
    ignores: ["dist/*", ".expo/*"],
  },
  {
    rules: {
      // False positive on Reanimated worklets: mutating a shared value's
      // `.value` inside a gesture callback is the correct, documented API,
      // not an effect-immutability violation.
      "react-hooks/immutability": "off",
      // Codebase convention throughout is `useEffect(() => { load(); }, [load])`
      // for data fetching; flagging every instance isn't actionable here.
      "react-hooks/set-state-in-effect": "off",

      // The type scale is nine tokens in src/lib/theme.ts and nothing else.
      // Before this rule there were 134 inline sizes across 17 distinct
      // values, four of which were not tokens at all, which is how the app
      // ended up with three different sizes for one rank of heading.
      "no-restricted-syntax": [
        "error",
        {
          selector: "Property[key.name='fontSize']",
          message:
            "Use a typography token from @/lib/theme (display1/display2/title/headline/body/bodyStrong/caption/micro/eyebrow). Sizes live in theme.ts only.",
        },
        {
          selector: "Property[key.name='fontWeight']",
          message:
            "Weight comes from the font family. Use fonts.regular/medium/semibold/bold, or the typography token that already carries it.",
        },
      ],
    },
  },
  {
    // theme.ts is where the scale is defined, so it is the one file allowed
    // to spell the numbers out.
    files: ["src/lib/theme.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
];
