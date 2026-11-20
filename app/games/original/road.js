const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
const playerSprite = new Image();
playerSprite.src = new URL("../../assets/coupe.png", import.meta.url).href;
const palette = {
  v: "#6352bc",
  l: "#aaa2fb",
  b: "#252441",
  p: "#424778",
  w: "#a0c9ec",
  r: "#fb536d",
  d: "#170f29",
  s: "#ddd0e1",
};
const coupe = [
  "        llllllllll        ",
  "       lwwwwwwwwwwl       ",
  "      lpbbbbbbbbbbpl      ",
  "     lvppppppppppppvl     ",
  "  llllllllllllllllllllll  ",
  " vvvvvvvvvvvvvvvvvvvvvvvv ",
  " lvrrrrrrbddddddbrrrrrrvl ",
  " vvvvvvvvddssssddvvvvvvvv ",
  "  pppppppppppppppppppppp  ",
  "  dddd              dddd  ",
];
function car(c, x, y, scale, color) {
  const block = Math.max(1, Math.round(scale));
  coupe.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch === " ") return;
      c.fillStyle = ch === "v" && color ? color : palette[ch];
      c.fillRect(
        Math.round(x + (i - 13) * scale),
        Math.round(y + (j - 10) * scale),
        block + 1,
        block + 1,
      );
    }),
  );
}
export function racer({ hud, tone, end, keys }, c) {
  let distance = 0,
    speed = 29,
    side = 0,
    lives = 3,
    invincible = 0,
    traffic = [],
    spawnIn = 1.2,
    remaining = 108;
  const horizon = 88,
    finish = 3000;
  const mountain = (x, layer) =>
    Math.sin(x * (0.022 + layer * 0.005) + layer * 2) * 8 +
    Math.sin(x * 0.073 + layer * 4) * 4 +
    Math.sin(x * 0.14) * 2;
  function road(t) {
    const curve =
      Math.sin(distance * 0.003) * 46 + Math.sin(distance * 0.0065) * 21;
    return {
      x: 192 + curve * (1 - t) * (1 - t),
      half: 11 + t * t * 160,
      y: horizon + Math.pow(t, 1.7) * 128,
    };
  }
  function metrics() {
    hud(
      Math.min(3, distance / 1000).toFixed(2) +
        " / 3.00 km  ·  " +
        Math.ceil(remaining) +
        "s",
      Math.round(speed * 3.6) + " km/h  ·  Lives " + lives,
    );
  }
  metrics();
  return {
    pointer(x) {
      side = clamp((x - 192) / 124, -1.1, 1.1);
    },
    update(dt) {
      const target = keys.has("ArrowUp") ? 49 : keys.has("ArrowDown") ? 17 : 30;
      speed += (target - speed) * Math.min(dt * 1.9, 1);
      const turning =
        (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0);
      side = clamp(side + turning * dt * 1.7, -1.13, 1.13);
      if (Math.abs(side) > 1) speed = Math.max(14, speed - dt * 22);
      distance += dt * speed;
      remaining = Math.max(0, remaining - dt);
      invincible -= dt;
      spawnIn -= dt;
      if (spawnIn <= 0) {
        traffic.push({
          away: 210,
          lane: [-0.68, 0, 0.68][Math.floor(Math.random() * 3)],
          color: ["#e2a45a", "#5d95a4", "#e4788a"][
            Math.floor(Math.random() * 3)
          ],
          checked: false,
        });
        spawnIn = 1.9 + Math.random() * 1.6;
      }
      traffic.forEach((a) => {
        a.away -= dt * speed * 0.9;
        if (a.away < 14 && !a.checked) {
          a.checked = true;
          if (Math.abs(side - a.lane) < 0.26 && invincible <= 0) {
            lives--;
            tone(90, 0.18);
            invincible = 1.8;
            if (!lives) end("End of the road", distance, "metres");
          }
        }
      });
      traffic = traffic.filter((a) => a.away > 0);
      metrics();
      if (distance >= finish) end("Finish line!", finish, "metres");
      else if (!remaining) end("The sun has set", distance, "metres");
    },
    draw() {
      const sky = [
        "#665193",
        "#845c9d",
        "#ad6c9e",
        "#d47b96",
        "#ed978f",
        "#f9b280",
        "#fac481",
      ];
      sky.forEach((color, i) => {
        c.fillStyle = color;
        c.fillRect(0, i * 14, 384, 15);
      });
      c.fillStyle = "#ffdb98";
      for (let y = -21; y < 22; y++) {
        if (y > 6 && y % 4 === 0) continue;
        const w = Math.sqrt(22 * 22 - y * y);
        c.fillRect(281 - w, 51 + y, w * 2, 1);
      }
      for (let i = 0; i < 11; i++) {
        const x = (i * 103 + 7) % 384,
          y = 9 + ((i * 19) % 55);
        c.fillStyle = i % 2 ? "#c58baa" : "#edacaa";
        c.fillRect(x, y, 13 + (i % 6) * 3, 2);
        c.fillRect(x + 6, y - 2, 10, 2);
      }
      for (let layer = 0; layer < 3; layer++) {
        c.fillStyle = ["#b47ba2", "#885b96", "#573f73"][layer];
        for (let x = 0; x < 384; x += 2) {
          const y =
            58 +
            layer * 11 +
            mountain(x + distance * (layer + 1) * 0.009, layer);
          c.fillRect(x, y | 0, 2, 98 - y);
        }
      }
      c.fillStyle = "#624563";
      c.fillRect(0, horizon, 384, 216 - horizon);
      for (let py = horizon; py < 216; py++) {
        const t = Math.pow((py - horizon) / 128, 1 / 1.7),
          r = road(t);
        const z = (1 / Math.max(0.025, t)) * 42 + distance;
        c.fillStyle = Math.floor(z / 10) % 2 ? "#684458" : "#624054";
        c.fillRect(0, py, 384, 1);
        c.fillStyle = Math.floor(z / 8) % 2 ? "#cc8c8a" : "#6d546e";
        c.fillRect(r.x - r.half - 1 - t * 4, py, r.half * 2 + 2 + t * 8, 1);
        c.fillStyle = "#3b344e";
        c.fillRect(r.x - r.half, py, r.half * 2, 1);
        if (Math.floor(z / 8) % 2) {
          c.fillStyle = "#eab6a2";
          for (const offset of [-1 / 3, 1 / 3])
            c.fillRect(r.x + r.half * offset, py, 1 + t * 2, 1);
        }
      }
      for (let i = 0; i < 18; i++) {
        const t = (i / 18 + distance * 0.00095) % 1,
          r = road(t),
          treeH = 3 + t * t * 46;
        for (const sign of [-1, 1]) {
          const x = r.x + sign * (r.half * (1.13 + (i % 4) * 0.13) + 6);
          c.fillStyle = "#3a2c4e";
          c.fillRect(x - 1, r.y - treeH, Math.max(1, t * 3), treeH);
          for (let j = 0; j < 3; j++) {
            const half = (3 - j) * treeH * 0.08;
            c.beginPath();
            c.moveTo(x, r.y - treeH + j * treeH * 0.16);
            c.lineTo(x - half * 2, r.y - treeH * 0.34 + j * treeH * 0.12);
            c.lineTo(x + half * 2, r.y - treeH * 0.34 + j * treeH * 0.12);
            c.fill();
          }
        }
      }
      for (const a of [...traffic].sort((a, b) => b.away - a.away)) {
        const t = clamp(1 - a.away / 220, 0, 1),
          r = road(t);
        car(c, r.x + r.half * a.lane, r.y, 0.15 + 2.6 * t * t, a.color);
      }
      if (invincible <= 0 || Math.floor(invincible * 9) % 2) {
        const center = Math.round(192 + side * 135);
        if (playerSprite.complete && playerSprite.naturalWidth) {
          c.drawImage(playerSprite, center - 40, 170, 80, 34);
        } else {
          car(c, center, 202, 2.6);
        }
      }
      c.fillStyle = "#282137";
      c.fillRect(8, 7, 105, 4);
      c.fillStyle = "#dcc0fa";
      c.fillRect(8, 7, Math.min(105, (105 * distance) / finish), 4);
    },
  };
}
