const skyEvents = document.getElementById("sky-events");
const nightHint = document.getElementById("night-hint");
const wishShell = document.getElementById("wish-shell");
const introTimer = setTimeout(() => document.body.classList.add("intro-quiet"), 16000);

function createMeteor(x = innerWidth * (0.22 + Math.random() * 0.5), y = innerHeight * 0.14) {
  const meteor = document.createElement("span");
  meteor.className = "meteor";
  meteor.style.left = `${x}px`;
  meteor.style.top = `${y}px`;
  meteor.style.setProperty("--drift-x", `${80 + Math.random() * 150}px`);
  meteor.style.setProperty("--drift-y", `${45 + Math.random() * 90}px`);
  skyEvents.append(meteor);
  meteor.addEventListener("animationend", () => meteor.remove(), { once: true });
}

function showNightHint() {
  if (!document.body.classList.contains("night")) return;
  nightHint.classList.add("show");
  setTimeout(() => nightHint.classList.remove("show"), 5200);
  setTimeout(() => createMeteor(), 900);
}

new MutationObserver(() => {
  if (document.body.classList.contains("night")) showNightHint();
}).observe(document.body, { attributes: true, attributeFilter: ["class"] });

document.addEventListener("pointerdown", (event) => {
  if (!document.body.classList.contains("night") || event.target.tagName !== "CANVAS") return;
  createMeteor(event.clientX - 70, event.clientY - 45);
});

const shellWords = [
  ["潮水退去后，沙滩总会留下新的光。", "你今天已经做得够好了。"],
  ["这枚贝壳替你收着一句小小的晚安。", "慢一点，也是一种抵达。"],
  ["把没有说完的话，留给海浪吧。", "此刻的呼吸，就很好。"],
];
let shellIndex = 0;
wishShell.addEventListener("click", () => {
  const words = shellWords[shellIndex++ % shellWords.length];
  wishShell.classList.remove("found");
  void wishShell.offsetWidth;
  wishShell.classList.add("found");
  const toast = document.getElementById("toast");
  toast.textContent = `${words[0]} ${words[1]}`;
  toast.hidden = false;
  setTimeout(() => {
    toast.hidden = true;
  }, 5200);
});
