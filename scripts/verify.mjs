import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron } from "playwright";
const profile = await mkdtemp(join(tmpdir(), "pixelport-test-"));
const errors = [];
const requests = new Set();
const displayArgs =
  process.platform === "linux" && process.env.DISPLAY
    ? ["--ozone-platform=x11"]
    : [];
const launch = () =>
  electron.launch({
    chromiumSandbox: true,
    ...(process.env.PIXELPORT_EXECUTABLE
      ? {
          executablePath: resolve(process.env.PIXELPORT_EXECUTABLE),
          args: displayArgs,
        }
      : { args: [...displayArgs, "."] }),
    env: { ...process.env, PIXELPORT_TEST_PROFILE: profile },
  });
let app,
  checking = "library";
async function start() {
  app = await launch();
  const page = await app.firstWindow();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      !/favicon|AudioContext was not allowed|GPU stall/.test(m.text())
    )
      errors.push(m.text());
  });
  page.on("request", (req) => {
    if (/^(https?|wss?):/.test(req.url())) requests.add(req.url());
  });
  await page.locator(".game-card").first().waitFor();
  return page;
}
const catalog = JSON.parse(await readFile("app/puzzles.json", "utf8")).concat(
  JSON.parse(await readFile("app/arcades.json", "utf8")),
);
const originals = [
  "snake",
  "blocks",
  "star",
  "cards",
  "sunset",
  "four",
  "reversi",
  "blackjack",
  "pairs",
  "merge",
];
const allIds = [...originals, ...catalog.map((g) => g.id)];
assert.equal(allIds.length, 100);
assert.equal(new Set(allIds).size, 100);
for (const id of allIds) await access("app/assets/covers/" + id + ".webp");
try {
  let page = await start();
  let netBoard;
  const names = await page.evaluate(async () =>
    Object.fromEntries(
      (await import("./catalog.js")).games.map((g) => [g.id, g.name]),
    ),
  );
  const open = async (id) => {
    await page.locator("#search").fill(names[id]);
    await page.locator(`.game-open[data-play="${id}"]`).click();
    const iframe = page.frameLocator("#stage iframe");
    return iframe;
  };
  const close = () => page.locator("#close-game").click();
  assert.equal(await page.locator("#game-count").textContent(), "100 games");
  await page.locator(".skip").focus();
  await page.keyboard.press("Enter");
  assert.equal(new URL(page.url()).hash, "#library");
  await page.locator('[data-nav="All games"]').click();
  const found = new Set();
  for (let n = 0; n < 7; n++) {
    for (const id of await page
      .locator(".game-open")
      .evaluateAll((nodes) => nodes.map((el) => el.dataset.play)))
      found.add(id);
    if (n < 6) await page.locator('[data-page="1"]').click();
  }
  assert.deepEqual([...found].sort(), allIds.sort());
  await page.locator('[data-nav="Discover"].nav-button').click();
  await page.locator('.fav[data-fav="snake"]').click();
  await page.locator('.fav[data-fav="cards"]').click();
  await page.locator('[data-nav="Favorites"]').click();
  await page.locator('[data-genre="Cards"]').click();
  await page.locator('.fav[data-fav="cards"]').click();
  assert.equal(await page.locator(".game-card").count(), 1);
  assert.equal(
    await page
      .locator('#filters [aria-pressed="true"]')
      .getAttribute("data-genre"),
    "All games",
  );
  await page.locator('[data-nav="All games"]').click();
  await page.locator('[data-genre="Cards"]').click();
  assert.deepEqual(await page.locator(".game-card h2").allTextContents(), [
    "Pocket Solitaire",
    "Twenty One",
  ]);
  await page.locator("#sort").selectOption("za");
  assert.equal(
    await page.locator(".game-card h2").first().textContent(),
    "Twenty One",
  );
  await page.locator("#sort").selectOption("featured");
  await page.locator("#list-view").click();
  assert.ok(
    await page
      .locator("#games")
      .evaluate((el) => el.classList.contains("list-mode")),
  );
  await page.locator("#grid-view").click();
  await page.locator('[data-nav="Brain teasers"]').click();
  assert.ok(
    (await page.locator("#game-count").textContent()).includes("games"),
  );
  await page.keyboard.press("/");
  assert.ok(
    await page
      .locator("#search")
      .evaluate((el) => el === document.activeElement),
  );
  await page.locator("#search").fill("not-a-real-game");
  assert.ok(await page.getByText("No matching games").isVisible());
  await page.keyboard.press("Escape");
  await page.locator("#profile").click();
  await page.locator("#name-field").fill("Tester");
  await page.locator("#save-profile").click();
  await page.locator("#sound").click();
  assert.equal(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.isAudioMuted(),
    ),
    true,
  );
  console.log(
    "Verified 100 unique library entries, pagination, collections, filters, search, sorting, favorites, layout, settings and keyboard shortcuts.",
  );
  for (const id of originals) {
    checking = id;
    if (id === "reversi")
      await page.evaluate(() =>
        localStorage.setItem("pixelport.table.reversi", "{}"),
      );
    let f = await open(id);
    if (["snake", "blocks", "star", "sunset"].includes(id)) {
      await f.locator("#start").click();
      const screen = () => f.locator("canvas").evaluate((el) => el.toDataURL());
      const a = await screen();
      await page.keyboard.press(id === "blocks" ? "Space" : "ArrowRight");
      await page.waitForTimeout(240);
      assert.notEqual(await screen(), a, id + " playfield should respond");
      if (id === "blocks")
        assert.notEqual(await f.locator("#metric").textContent(), "Score  0");
      if (id === "star") {
        await page.keyboard.down("Space");
        await page.waitForTimeout(650);
        await page.keyboard.up("Space");
      }
      await page.keyboard.press("Escape");
      await page
        .getByRole("heading", { name: "Game paused", exact: true })
        .waitFor();
      const paused = await screen();
      await page.waitForTimeout(100);
      assert.equal(await screen(), paused);
      await page
        .getByRole("button", { name: "Resume game", exact: true })
        .click();
    } else if (id === "cards") {
      await f.getByRole("button", { name: /Draw from stock/ }).click();
      assert.equal(await f.locator("#metric").textContent(), "Moves  1");
      await f.getByRole("button", { name: "Undo", exact: true }).click();
      assert.equal(await f.locator("#metric").textContent(), "Moves  0");
      await f.getByRole("button", { name: "Hint", exact: true }).click();
      assert.ok((await f.locator(".turn").textContent()).length > 5);
    } else if (id === "four") {
      const column = f.locator('.board button[data-column="4"][tabindex="0"]');
      await column.waitFor();
      assert.equal(await f.locator('.board button[tabindex="0"]').count(), 7);
      await column.press("Enter");
      await f.locator(".disc.dark").waitFor();
      assert.equal(await f.locator(".disc.light").count(), 1);
    } else if (id === "reversi") {
      await f.locator(".board button:enabled").first().click();
      await f.locator(".disc").nth(5).waitFor();
      assert.equal(await f.locator(".disc").count(), 6);
    } else if (id === "blackjack") {
      if (await f.getByRole("button", { name: "Deal again" }).isVisible())
        await f.getByRole("button", { name: "Deal again" }).click();
      if (
        await f.getByRole("button", { name: "Stand", exact: true }).isVisible()
      )
        await f.getByRole("button", { name: "Stand", exact: true }).click();
      await f.getByRole("button", { name: "Deal again" }).waitFor();
    } else if (id === "pairs") {
      await f.locator(".board button").nth(0).click();
      const saved = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("pixelport.table.pairs")),
      );
      assert.deepEqual(saved.open, [0]);
      const different = saved.deck.findIndex(
        (symbol) => symbol !== saved.deck[0],
      );
      await f.locator(".board button").nth(different).click();
      await page.locator("#pause").click();
      await page.waitForTimeout(950);
      assert.equal(await f.locator(".board .open").count(), 2);
      await page
        .getByRole("button", { name: "Resume game", exact: true })
        .click();
      await f.locator(".board .open").first().waitFor({ state: "hidden" });
      assert.equal(await f.locator("#metric").textContent(), "Moves  1");
      await f.locator(".board button").nth(0).click();
    } else if (id === "merge") {
      await f.locator(".board").click();
      const start = await f.locator(".tile").allTextContents();
      for (const key of ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp"])
        await page.keyboard.press(key);
      assert.notDeepEqual(await f.locator(".tile").allTextContents(), start);
    }
    await page.locator("#how").click();
    await page.locator("#pause-copy p").first().waitFor();
    assert.ok(await page.locator("#pause-copy").textContent());
    await page
      .getByRole("button", { name: "Resume game", exact: true })
      .click();
    await close();
  }
  console.log(
    "Verified play input and controls in all 10 Pixelport originals.",
  );
  for (const [index, g] of catalog.entries()) {
    checking = g.id;
    const f = await open(g.id);
    if (g.engine === "puzzle") {
      const canvas = f.locator("#puzzlecanvas");
      await canvas.waitFor();
      const loaded = page
        .frames()
        .find((frame) => frame.url().endsWith("/" + g.id + ".html"));
      await loaded.waitForFunction(
        () => typeof window.savePixelportGame === "function",
      );
      const save = () =>
        loaded.evaluate(() => {
          savePixelportGame();
          return localStorage.getItem("pixelport.board." + location.pathname);
        });
      const before = await save();
      assert.ok(before.includes("GAME"), g.id + " should serialize a board");
      await canvas.click();
      await f.locator("#new").click();
      const after = await save();
      assert.ok(
        after.includes("DESC") && after !== before,
        g.id + " new board",
      );
      if (g.id === "net") {
        await f
          .locator("#gamemenu div")
          .filter({ hasText: "Game" })
          .first()
          .hover();
        await f.locator("#save").click();
        const exportPath = join(profile, "net.sav");
        await app.evaluate(({ session }, path) => {
          session.defaultSession.once("will-download", (_event, item) => item.setSavePath(path));
        }, exportPath);
        await f.locator("#dlgform a[download]").press("Enter");
        let exported;
        for (let attempt = 0; attempt < 50; attempt++) {
          exported = await readFile(exportPath, "utf8").catch(() => "");
          if (exported.includes("DESC")) break;
          await page.waitForTimeout(100);
        }
        assert.ok(exported.includes("SAVEFILE") && exported.includes("DESC"));
        await page.keyboard.press("Escape");
        await f.locator("#dlgform").waitFor({ state: "hidden" });
        assert.ok(!(await page.locator("#pause-layer").isVisible()));
        await canvas.click({
          position: {
            x: Math.floor((await canvas.boundingBox()).width * 0.4),
            y: Math.floor((await canvas.boundingBox()).height * 0.4),
          },
        });
        assert.ok(await f.locator("#undo").isEnabled());
        await f.locator("#undo").click();
        netBoard = (await save())
          .split("\n")
          .filter((line) => line.startsWith("DESC") || line.startsWith("MOVE"))
          .join("\n");
      }
    } else {
      const canvas = f.locator("canvas");
      await canvas.waitFor();
      await f
        .locator('body[data-game-state="title"]')
        .waitFor({ state: "attached" });
      await canvas.click({ delay: 50 });
      const loaded = page
        .frames()
        .find((frame) => frame.url().endsWith("game=" + g.id));
      await loaded.waitForFunction(
        () => document.body.dataset.gameState === "inGame" && window.ticks > 1,
      );
      const snap = () =>
        loaded.evaluate(() => document.querySelector("canvas").toDataURL());
      const before = await snap();
      await page.keyboard.down("Space");
      await page.waitForTimeout(130);
      await page.keyboard.up("Space");
      await page.waitForTimeout(115);
      assert.ok(
        await loaded.evaluate(
          () =>
            typeof window.update === "function" &&
            typeof window.score === "number",
        ),
      );
      const changed = before !== (await snap());
      if (!changed) {
        const box = await canvas.boundingBox();
        await canvas.click({
          position: {
            x: Math.round(box.width * 0.15),
            y: Math.round(box.height * 0.78),
          },
          delay: 60,
        });
        await page.waitForTimeout(80);
        assert.ok(
          before !== (await snap()),
          g.id + " gameplay must respond to input",
        );
      }
    }
    await close();
    if ((index + 1) % 10 === 0)
      console.log("Verified " + (index + 1) + " / 90 bundled games");
    if (errors.length) throw Error(g.id + " errors: " + errors.join("\n"));
  }
  await page.locator("#search").fill("");
  await page.locator('[data-nav="Recently played"]').click();
  assert.equal(await page.locator("#game-count").textContent(), "100 games");
  await app.close();
  app = null;
  page = await start();
  assert.equal(await page.locator("#player-name").textContent(), "Tester");
  await page.locator('[data-nav="Favorites"]').click();
  assert.equal(
    await page.locator(".game-card h2").textContent(),
    "Neon Serpent",
  );
  await page.locator('[data-nav="Recently played"]').click();
  assert.equal(await page.locator("#game-count").textContent(), "100 games");
  checking = "restart and persistence";
  const f = await open("four");
  await f.locator(".board").waitFor();
  assert.equal(await f.locator(".disc").count(), 2);
  await close();
  const puzzle = await open("net");
  await puzzle.locator("#puzzlecanvas").waitFor();
  const restoredPuzzle = page
    .frames()
    .find((frame) => frame.url().endsWith("/net.html"));
  await restoredPuzzle.waitForFunction(
    () => typeof window.savePixelportGame === "function",
  );
  const restoredBoard = await restoredPuzzle.evaluate(() => {
    savePixelportGame();
    return localStorage
      .getItem("pixelport.board." + location.pathname)
      .split("\n")
      .filter((line) => line.startsWith("DESC") || line.startsWith("MOVE"))
      .join("\n");
  });
  assert.ok(netBoard && netBoard.startsWith("DESC"));
  assert.equal(
    restoredBoard,
    netBoard,
    "The puzzle layout and move history must survive restart",
  );
  await restoredPuzzle.evaluate(() => {
    // Exercise the failure path in the temporary test profile.
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
    savePixelportGame();
  });
  await page.locator("#game-save-warning").waitFor();
  await close();
  await page.locator("#play-dialog").waitFor({ state: "hidden" });
  const memory = await open("pairs");
  await memory.locator(".board .open").waitFor();
  assert.equal(await memory.locator(".board .open").count(), 1);
  assert.equal(await memory.locator("#metric").textContent(), "Moves  1");
  await close();
  assert.equal(requests.size, 0, "All resources must be local");
  assert.deepEqual(errors, []);
  console.log(
    "PASS · All 100 games launched and responded to play input. Local progress survived a desktop restart. No remote requests or runtime errors.",
  );
} catch (error) {
  console.error("While verifying " + checking);
  throw error;
} finally {
  if (app) await app.close();
  await rm(profile, { recursive: true, force: true });
}
