# Project notes for agents

Static, no-build, terminal-themed personal site: plain HTML, CSS and JavaScript.
No package manager, no bundler, no tests. Deployed to GitHub Pages from `main`
(custom domain `dmitry.popov.engineer`).

## Run locally

```bash
python3 -m http.server 5173 --bind 127.0.0.1
# → http://127.0.0.1:5173
```

`http.server` is Python's standard library — nothing to install. Any static
server works (`npx serve -l 5173`, `php -S 127.0.0.1:5173`, Live Server).

A server is required for a faithful preview: routes in `assets/terminal.js`, the
home nav and the 404 `<base>` are root-absolute, so `file://` breaks navigation.
Stop with `Ctrl+C`, or `lsof -ti tcp:5173 | xargs kill`.

## Conventions worth knowing

- **Colours** are tokens in `assets/styles.css`; light/dark is chosen from the
  visitor's local clock in `assets/theme-boot.js` (10:00–22:00 light, otherwise
  dark). There is no manual theme switch and nothing is persisted.
- **Traffic lights**: red ends the session (blinking cursor + "press any key"),
  yellow pauses to the static page, green goes full screen with the section tabs
  as a bottom dock. All are real buttons with `aria-label`/`aria-pressed`.
- **No-JS**: every page ships a `<noscript>` document with the same content;
  `assets/terminal.js` reuses that markup for pause mode — keep it as the single
  source when editing content.
- **Content lives in each page's inline `bootTerminal({ lines: [...] })`** config,
  mirrored in that page's `<noscript>`. Change both.
- **`sitemap.xml`**: bump `lastmod` for changed pages. `githooks/pre-commit`
  does it automatically once enabled with `git config core.hooksPath githooks`
  (the hook also scans staged lines for secrets).
- **`assets/cv.pdf`** is rendered from `assets/cv.html`; after editing the CV:

  ```bash
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --headless=new --print-to-pdf="assets/cv.pdf" --no-pdf-header-footer \
    "file://$PWD/assets/cv.html"
  ```

  In a sandboxed shell add `--no-sandbox --disable-gpu`.
