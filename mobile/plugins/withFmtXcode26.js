/**
 * fmt 11 does not compile under Xcode 26.
 *
 * Apple Clang 17 tightened `consteval`, and fmt's `FMT_USE_CONSTEVAL` path
 * trips it: "call to consteval function is not a constant expression",
 * repeated through format-inl.h. React Native 0.76 pins fmt 11.0.2, so every
 * clean build of this app fails (facebook/react-native#55601).
 *
 * This lived as a hand-edit in ios/Podfile, which `expo prebuild` generates
 * and .gitignore excludes — so it survived only on one machine. A fresh clone
 * or a git worktree regenerated a clean Podfile and could not build at all.
 * As a config plugin it is tracked, versioned, and reapplied on every prebuild.
 *
 * Two parts, both needed: turn fmt's consteval path off at the source, and
 * stop the Podfile from forcing the fmt target back to C++17.
 */
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

const MARKER = "Xcode 26 fmt workaround (plugins/withFmtXcode26.js)";

const HOOK = `
    # ${MARKER}
    fmt_base = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      content = File.read(fmt_base)
      unless content.include?('${MARKER}')
        patched = content.gsub(
          /^(#elif defined\\(__cpp_consteval\\)\\n# define FMT_USE_CONSTEVAL) 1/m,
          "// ${MARKER}\\n\\\\1 0"
        )
        if patched != content
          File.chmod(0644, fmt_base)
          File.write(fmt_base, patched)
        end
      end
    end

    installer.pods_project.targets.each do |target|
      next unless target.name == 'fmt'
      target.build_configurations.each do |config|
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'
      end
    end
`;

/** Exported for testing: insert the hook into a Podfile's post_install block. */
function patchPodfile(contents) {
  if (contents.includes(MARKER)) return contents;
  const i = contents.indexOf("post_install do |installer|");
  if (i === -1) throw new Error("withFmtXcode26: no post_install block in the Podfile");
  const nl = contents.indexOf("\n", i);
  return contents.slice(0, nl + 1) + HOOK + contents.slice(nl + 1);
}

module.exports = function withFmtXcode26(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      fs.writeFileSync(file, patchPodfile(fs.readFileSync(file, "utf8")));
      return cfg;
    },
  ]);
};
module.exports.patchPodfile = patchPodfile;
