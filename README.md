# ROAD FM

A game-agnostic radio companion for listening to YouTube playlists together. ROAD FM runs alongside your game, keeps playback in YouTube's visible player, and synchronizes station and transport controls between people in a listening room. It does not modify game files or relay audio.

## Run locally

1. Install Node.js 18 or newer.
2. Double-click `start.cmd`, or run it from Command Prompt.
3. Open [http://localhost:4173](http://localhost:4173).
4. Add YouTube playlist links as station presets. Presets are saved in that browser.
5. One listener selects **Start a room** and shares the six-character code. Others open the same address and join with that code.

The room host controls station changes, play/pause, and track skips. Each listener controls their own volume. Keep the YouTube player visible; the browser may require a click on Play before playback begins.

## Use it alongside a game on Windows

The optional Electron companion opens ROAD FM in an always-on-top compact window and provides system-wide radio shortcuts while the game is focused. Use the game in borderless-windowed or windowed mode; exclusive fullscreen can cover desktop overlays.

1. Run `desktop/start.cmd` from the cloned repository. On first run it installs Electron.
2. Select **Full app** in the overlay to add station presets or create/join a listening room. Presets are shared between the overlay and full app.
3. Return to the overlay and tune channels there. Start playback once inside YouTube if prompted.

Shortcuts while the desktop companion is running:

- `Ctrl+Alt+Up/Down`: previous/next station
- `Ctrl+Alt+Left/Right`: previous/next track
- `Ctrl+Alt+Space`: play/pause

This is a desktop overlay, not an injected game mod. It cannot mix music into the game's 3D audio or appear over exclusive-fullscreen rendering. The compact window is 520×260 and keeps the YouTube player at its 200×200 minimum supported embed size; hiding or reducing YouTube further isn't supported by its embedded player. A video-free radio mode would need separately licensed audio-only streams.

## Deploy from GitHub

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/afuchi/road-fm)

Select **Deploy Blueprint**, sign in to Render with GitHub, and authorize the ROAD FM repository. Render reads `render.yaml`, builds the Node app, and gives you an HTTPS address to share. The included Web Service supports the room's WebSocket connection, unlike GitHub Pages.

The free Render service may sleep while idle, so the first visit or room after a quiet period can take a little longer to start. Active rooms are in memory and end when the service restarts or redeploys.

## Hosting with friends

For other hosts, choose a service that supports persistent WebSockets and HTTPS; ROAD FM uses secure WebSockets automatically when served over HTTPS. Do not expose an unauthenticated development server directly to the public internet. Treat room codes as private links and share them only with people you trust.

## Limitations

- ROAD FM is a companion app, not a game plugin. It does not embed itself in a game or change game audio.
- Every listener uses their own YouTube player. Ads, regional or age restrictions, browser autoplay rules, and playlist changes can cause playback drift or prevent a video from playing.
- Public or unlisted playlists are easiest to embed. Private playlist/account integration is not included.
- The app shares playlist IDs and playback state only. It does not download, extract, or transmit music.