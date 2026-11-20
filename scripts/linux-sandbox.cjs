const fs = require("node:fs");
const path = require("node:path");

// Ubuntu can restrict unprivileged namespaces. Reuse a system-installed,
// root-owned Chromium helper in user-local builds on those machines.
function prepareLocalRuntime(executable) {
  if (process.platform !== "linux") return;
  const restriction = "/proc/sys/kernel/apparmor_restrict_unprivileged_userns";
  if (
    !fs.existsSync(restriction) ||
    fs.readFileSync(restriction, "utf8").trim() !== "1"
  )
    return;
  const local = path.join(path.dirname(executable), "chrome-sandbox");
  function installedHelper(candidate) {
    try {
      const s = fs.statSync(candidate);
      return s.isFile() && s.uid === 0 && (s.mode & 0o4777) === 0o4755;
    } catch {
      return false;
    }
  }
  if (installedHelper(local)) return;
  const available = [
    "/opt/google/chrome/chrome-sandbox",
    "/usr/lib/chromium/chrome-sandbox",
    "/usr/lib/chromium-browser/chrome-sandbox",
  ].find(installedHelper);
  if (!available) return;
  const temp = local + ".pixelport-" + process.pid;
  fs.symlinkSync(available, temp);
  fs.renameSync(temp, local);
}
module.exports = { prepareLocalRuntime };
if (require.main === module) prepareLocalRuntime(require("electron"));
