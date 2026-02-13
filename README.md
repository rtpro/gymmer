# Gymmer

A mobile-first web app for gym workouts: **work** and **rest** interval timer with sets, presets, and completion history.

Optimized for **Android** (and works in any modern browser): large touch targets, safe areas, and a theme color for the browser chrome.

## GitHub Pages (live app)

1. Push this repo to GitHub (create a repo and push the `gymmer` folder contents to the root of the repo).
2. In the repo: **Settings** → **Pages** → **Build and deployment** → **Source**: choose **Deploy from a branch**.
3. Under **Branch**: select `main` (or your default branch), folder **/ (root)**, then **Save**.
4. After a minute or two, the app will be live at:
   - **https://\<your-username\>.github.io/\<repo-name\>/**
   - Example: if the repo is `github.com/username/gymmer`, the app is at **https://username.github.io/gymmer/**.

All paths in the app are relative, so it works correctly when served from a subpath like `/gymmer/`.

## Run locally

Serve the folder with any static server:

```bash
python3 -m http.server 8080
# Open http://localhost:8080 (or your LAN IP:8080 on the phone)

# Or with Node
npx serve .
```

## Add to home screen (Android)

1. Open the app (GitHub Pages URL or local server) in Chrome.
2. Menu (⋮) → **Add to Home screen** or **Install app**.
3. Use the icon like a normal app; it runs in a browser window without the address bar.
 