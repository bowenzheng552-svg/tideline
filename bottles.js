const bottleDialog = document.getElementById("bottle-dialog");
const bottleReceiveView = document.getElementById("bottle-receive-view");
const bottleWriteView = document.getElementById("bottle-write-view");
const bottleReceiveTab = document.getElementById("bottle-receive-tab");
const bottleWriteTab = document.getElementById("bottle-write-tab");
const bottleIncoming = document.getElementById("bottle-incoming");
const bottleMessageText = document.getElementById("bottle-message-text");
const bottleFrom = document.getElementById("bottle-from");
const bottleReplies = document.getElementById("bottle-replies");
const bottleStatus = document.getElementById("bottle-receive-status");
const bottleReplyForm = document.getElementById("bottle-reply-form");
const bottleNext = document.getElementById("bottle-next");

const clientKey = "tideline-bottle-client";
const seenKey = "tideline-bottle-seen";
let clientId = localStorage.getItem(clientKey);
if (!clientId) {
  clientId = crypto.randomUUID?.() || `shore-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(clientKey, clientId);
}
let currentBottle = null;
let seen = JSON.parse(localStorage.getItem(seenKey) || "[]");

function switchBottleView(view) {
  const receiving = view === "receive";
  bottleReceiveView.hidden = !receiving;
  bottleWriteView.hidden = receiving;
  bottleReceiveTab.classList.toggle("selected", receiving);
  bottleWriteTab.classList.toggle("selected", !receiving);
}

function renderReplies(replies = []) {
  bottleReplies.replaceChildren();
  for (const reply of replies) {
    const item = document.createElement("div");
    item.className = "bottle-reply";
    const name = document.createElement("small");
    const text = document.createElement("p");
    name.textContent = reply.from || "潮水";
    text.textContent = reply.text;
    item.append(name, text);
    bottleReplies.append(item);
  }
}

async function receiveBottle() {
  bottleStatus.textContent = "正在等潮水送来一只瓶子…";
  bottleIncoming.hidden = true;
  bottleReplyForm.hidden = true;
  bottleNext.hidden = true;
  try {
    const query = new URLSearchParams({
      clientId,
      seen: seen.slice(-30).join(","),
    });
    const response = await fetch(`/api/bottles/random?${query}`, {
      signal: AbortSignal.timeout(12000),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "潮水暂时很安静。");
    if (!payload.bottle) {
      bottleStatus.textContent = "海面上暂时没有新的瓶子。你可以先写一封，让它漂向别人。";
      return;
    }
    currentBottle = payload.bottle;
    seen = [...new Set([...seen, currentBottle.id])];
    localStorage.setItem(seenKey, JSON.stringify(seen));
    bottleStatus.textContent = "一封从远处漂来的树洞。";
    bottleFrom.textContent = `${currentBottle.from} · ${new Date(currentBottle.createdAt).toLocaleDateString("zh-CN")}`;
    bottleMessageText.textContent = currentBottle.text;
    renderReplies(currentBottle.replies);
    bottleIncoming.hidden = false;
    bottleReplyForm.hidden = false;
    bottleNext.hidden = false;
  } catch (error) {
    bottleStatus.textContent = error.message || "瓶子暂时没有靠岸。";
  }
}

window.openBottleHole = () => {
  switchBottleView("receive");
  if (!bottleDialog.open) bottleDialog.showModal();
  receiveBottle();
};

window.sendBottle = async (text) => {
  const response = await fetch("/api/bottles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, clientId, from: "一位海边的旅人" }),
    signal: AbortSignal.timeout(12000),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "瓶子暂时没有送出去。");
  return payload.bottle;
};

bottleReplyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentBottle) return;
  const input = document.getElementById("bottle-reply-input");
  const text = input.value.trim();
  if (!text) return;
  const button = bottleReplyForm.querySelector("button");
  button.disabled = true;
  try {
    const response = await fetch(`/api/bottles/${currentBottle.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, from: "一位海边的旅人" }),
      signal: AbortSignal.timeout(12000),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "回信没有送进瓶子。");
    currentBottle = payload.bottle;
    renderReplies(currentBottle.replies);
    input.value = "";
    bottleStatus.textContent = "回信已经顺着潮水漂回去了。";
  } catch (error) {
    bottleStatus.textContent = error.message || "回信暂时没有送进瓶子。";
  } finally {
    button.disabled = false;
  }
});

bottleNext.addEventListener("click", receiveBottle);
bottleReceiveTab.addEventListener("click", () => switchBottleView("receive"));
bottleWriteTab.addEventListener("click", () => switchBottleView("write"));
