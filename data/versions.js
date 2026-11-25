/*
 * Eaglercraft version catalogue.
 *
 * Source:   https://eaglercraft.com/play  (version picker + per-version detail pane)
 * Fetched:  2026-11-25
 *
 * Every `slug` below was checked against https://eaglercraft.com/play?version=<slug>
 * and returned that version's own detail pane. The exception is "Modpacks": the site
 * has no deep-link slug for it, so it opens the plain /play page.
 *
 * Images come from eaglercraft.com's public /versions/ folder.
 */
window.QUASORIA_SOURCE = {
  name: "eaglercraft.com",
  url: "https://eaglercraft.com/play",
  fetched: "2026-11-25",
};

window.QUASORIA_VERSIONS = [
  {
    id: "26.3",
    name: "Eaglercraft 26.3",
    short: "26.3",
    category: "modern",
    era: "2026",
    image: "26-3.png",
    description:
      "The newest version in your browser, with the latest blocks, mobs and biomes on top of the classics.",
    badges: ["Newest"],
    runtimes: [{ id: "default", label: "Standard", slug: "26.3" }],
  },
  {
    id: "26.2",
    name: "Eaglercraft 26.2",
    short: "26.2",
    category: "modern",
    era: "2026",
    image: "26.png",
    description:
      "A modern version in your browser, with years of updates of new blocks, mobs and biomes on top of the classics.",
    badges: ["Featured"],
    runtimes: [{ id: "default", label: "Standard", slug: "26.2" }],
  },
  {
    id: "1.12.2",
    name: "Eaglercraft 1.12.2",
    short: "1.12.2",
    category: "release",
    era: "2017",
    image: "1_12.png",
    description:
      "The World of Color update: concrete, terracotta, parrots and the recipe book. Runs on desktop browsers.",
    badges: ["Desktop"],
    runtimes: [
      { id: "wasm", label: "WebAssembly", note: "Faster", slug: "1.12.2-wasm" },
      { id: "js", label: "JavaScript", note: "Compatible", slug: "1.12.2" },
    ],
  },
  {
    id: "1.8.8",
    name: "Eaglercraft 1.8.8",
    short: "1.8.8",
    category: "release",
    era: "2015",
    image: "1_8.png",
    description:
      "The version almost every Eaglercraft server runs. PvP, minigames, survival and skyblock, with the WebAssembly build for the best frame rates.",
    badges: ["Most servers"],
    runtimes: [
      { id: "wasm", label: "WebAssembly", note: "Faster", slug: "1.8.8-wasm" },
      { id: "js", label: "JavaScript", note: "Compatible", slug: "1.8.8" },
    ],
  },
  {
    id: "modpacks",
    name: "Modpacks",
    short: "Forge",
    category: "modded",
    era: "Forge",
    image: "forge.png",
    description:
      "Community modpacks built on Eaglercraft. Opens the eaglercraft.com picker, where you choose Modpacks.",
    badges: ["Modded"],
    runtimes: [{ id: "default", label: "Standard", slug: null }],
  },
  {
    id: "1.5.2",
    name: "Eaglercraft 1.5.2",
    short: "1.5.2",
    category: "release",
    era: "2013",
    image: "1_5.png",
    description:
      "The original Eaglercraft. Redstone update era, light on hardware, still loved on school Chromebooks.",
    badges: ["Original"],
    runtimes: [{ id: "default", label: "Standard", slug: "1.5.2" }],
  },
  {
    id: "b1.7.3",
    name: "Beta 1.7.3",
    short: "b1.7.3",
    category: "legacy",
    era: "2011",
    image: "b1_7_3.png",
    description:
      "The golden age of Beta: pistons, no hunger, and the old terrain generator.",
    badges: [],
    runtimes: [{ id: "default", label: "Standard", slug: "b1.7.3" }],
  },
  {
    id: "b1.3",
    name: "Beta 1.3",
    short: "b1.3",
    category: "legacy",
    era: "2011",
    image: "b1_3.png",
    description: "Early Beta with beds, repeaters and slabs. A slice of 2011.",
    badges: [],
    runtimes: [{ id: "default", label: "Standard", slug: "b1.3" }],
  },
  {
    id: "a1.2.6",
    name: "Alpha 1.2.6",
    short: "a1.2.6",
    category: "legacy",
    era: "2010",
    image: "a1_2_6.png",
    description:
      "Alpha, where the Nether first opened. Simple, quiet and nostalgic.",
    badges: [],
    runtimes: [{ id: "default", label: "Standard", slug: "a1.2.6" }],
  },
  {
    id: "indev",
    name: "Indev",
    short: "Indev",
    category: "legacy",
    era: "2009",
    image: "indev.png",
    description:
      "The 2009 in-development build with finite worlds and floating islands.",
    badges: [],
    runtimes: [{ id: "default", label: "Standard", slug: "indev" }],
  },
];
