const {
  mkdtemp,
  cp,
  mkdir,
  readFile,
  writeFile,
  chmod,
  rm,
  access,
} = require("node:fs/promises");
const { execFileSync } = require("node:child_process");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { prepareLocalRuntime } = require("./linux-sandbox.cjs");
const debianDependencies = [
  "libasound2t64 | libasound2",
  "libatk-bridge2.0-0t64 | libatk-bridge2.0-0",
  "libatk1.0-0t64 | libatk1.0-0",
  "libatspi2.0-0t64 | libatspi2.0-0",
  "libc6",
  "libcairo2",
  "libcups2t64 | libcups2",
  "libdbus-1-3",
  "libexpat1",
  "libgbm1",
  "libgcc-s1",
  "libglib2.0-0t64 | libglib2.0-0",
  "libgtk-3-0t64 | libgtk-3-0",
  "libnspr4",
  "libnss3",
  "libpango-1.0-0",
  "libudev1",
  "libx11-6",
  "libx11-xcb1",
  "libxcb1",
  "libxcomposite1",
  "libxdamage1",
  "libxext6",
  "libxfixes3",
  "libxkbcommon0",
  "libxrandr2",
  "libxss1",
  "libxtst6",
];
async function build() {
  if (process.platform === "linux") process.umask(0o022);
  const { packager } = await import("@electron/packager");
  const source = resolve(__dirname, ".."),
    output = join(source, "dist");
  const manifest = JSON.parse(
    await readFile(join(source, "package.json"), "utf8"),
  );
  const staging = await mkdtemp(join(tmpdir(), "pixelport-build-"));
  try {
    const src = join(staging, "source");
    await mkdir(src);
    for (const name of [
      "app",
      "desktop.cjs",
      "preload.cjs",
      "resource-policy.cjs",
    ])
      await cp(join(source, name), join(src, name), { recursive: true });
    await writeFile(
      join(src, "package.json"),
      JSON.stringify({
        name: manifest.name,
        version: manifest.version,
        productName: manifest.productName,
        main: manifest.main,
        description: manifest.description,
      }),
    );
    const [bundle] = await packager({
      dir: src,
      name: "Pixelport",
      out: output,
      overwrite: true,
      asar: true,
      prune: false,
      electronVersion: manifest.devDependencies.electron,
      appBundleId: "games.pixelport.desktop",
      appCategoryType: "public.app-category.games",
    });
    if (process.platform === "linux") {
      const arch = { x64: "amd64", arm64: "arm64", ia32: "i386" }[process.arch];
      const debRoot = join(staging, "deb");
      const appFolder = join(debRoot, "opt", "pixelport");
      await chmod(bundle, 0o755);
      await cp(bundle, appFolder, { recursive: true });
      await chmod(join(appFolder, "chrome-sandbox"), 0o4755);
      const applications = join(debRoot, "usr/share/applications"),
        icons = join(debRoot, "usr/share/icons/hicolor/512x512/apps");
      for (const dir of [applications, icons, join(debRoot, "DEBIAN")])
        await mkdir(dir, { recursive: true });
      await cp(join(src, "app/assets/icon.png"), join(icons, "pixelport.png"));
      await writeFile(
        join(applications, "pixelport.desktop"),
        "[Desktop Entry]\nType=Application\nName=Pixelport\nComment=Play 100 offline games\nExec=/opt/pixelport/Pixelport\nIcon=pixelport\nTerminal=false\nCategories=Game;\nStartupWMClass=Pixelport\n",
      );
      await writeFile(
        join(debRoot, "DEBIAN/control"),
        `Package: pixelport\nVersion: ${manifest.version}\nArchitecture: ${arch}\nMaintainer: Pixelport\nSection: games\nPriority: optional\nDepends: ${debianDependencies.join(", ")}\nDescription: Pixelport offline desktop arcade\n A searchable collection of one hundred arcade, puzzle, card, racing,\n strategy, action and sports games.\n`,
      );
      const file = join(output, `pixelport_${manifest.version}_${arch}.deb`);
      execFileSync(
        "dpkg-deb",
        ["--root-owner-group", "-Zxz", "-z3", "--build", debRoot, file],
        {
          stdio: "inherit",
          env: { ...process.env, DPKG_DEB_THREADS_MAX: "4" },
        },
      );
      await access(file);
      prepareLocalRuntime(join(bundle, "Pixelport"));
    }
    console.log("Desktop bundle ready at " + bundle);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
build().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
