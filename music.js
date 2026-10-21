const musicPanel = document.getElementById("music-panel");
const musicMarker = document.getElementById("music-marker");
const musicSearch = document.getElementById("music-search");
const musicQuery = document.getElementById("music-query");
const musicResults = document.getElementById("music-results");
const musicStatus = document.getElementById("music-status");
const musicAudio = document.getElementById("music-audio");

function openMusic() {
  musicPanel.hidden = false;
  musicQuery.focus();
  if (!musicResults.children.length) {
    musicQuery.value = "ocean piano";
    searchMusic();
  }
}

async function searchMusic() {
  const query = musicQuery.value.trim();
  if (!query) return;
  musicStatus.textContent = "正在海风里找歌…";
  musicResults.replaceChildren();
  try {
    const response = await fetch(`/api/music?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(15000),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "没有找到音乐");
    if (!payload.results?.length) {
      musicStatus.textContent = "没有找到，换个关键词吧。";
      return;
    }
    musicStatus.textContent = "轻点一首，让留声机响起来。";
    for (const item of payload.results) {
      const button = document.createElement("button");
      button.className = "music-result";
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      const artist = document.createElement("small");
      title.textContent = item.title;
      artist.textContent = item.artist;
      copy.append(title, artist);
      const play = document.createElement("i");
      play.textContent = "▶";
      button.append(copy, play);
      button.addEventListener("click", async () => {
        musicAudio.src = item.preview;
        if ("mediaSession" in navigator && "MediaMetadata" in window) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: item.title,
            artist: item.artist,
            album: "海岸留声机",
            artwork: item.cover ? [{ src: item.cover, sizes: "60x60", type: "image/jpeg" }] : [],
          });
        }
        musicStatus.textContent = `${item.title} · ${item.artist}`;
        try {
          await musicAudio.play();
        } catch {
          musicStatus.textContent = "浏览器拦截了自动播放，请再点一次。";
        }
      });
      musicResults.append(button);
    }
  } catch (error) {
    musicStatus.textContent = error.message || "音乐暂时没有送达。";
  }
}

window.openMusicPanel = openMusic;
if (musicMarker) musicMarker.addEventListener("click", openMusic);
musicSearch.addEventListener("submit", (event) => {
  event.preventDefault();
  searchMusic();
});
musicAudio.loop = true;
musicAudio.addEventListener("play", () => {
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
});
musicAudio.addEventListener("pause", () => {
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
});
if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("play", () => musicAudio.play());
  navigator.mediaSession.setActionHandler("pause", () => musicAudio.pause());
  navigator.mediaSession.setActionHandler("stop", () => musicAudio.pause());
}
