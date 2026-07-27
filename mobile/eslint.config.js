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
    },
  },
];
