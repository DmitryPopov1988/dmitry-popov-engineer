# dmitry.popov.engineer

Personal site of Dmitry Popov, Senior Software Engineer.

A static, no-build, terminal-themed multi-page site. Each page is a fake shell
session with an interactive prompt that doubles as the navigation.

## Structure

```
.
├── index.html          # > whoami (home / hero)
├── experience.html     # > experience (career timeline)
├── projects.html       # > projects (selected work)
├── contact.html        # > contact (email, linkedin, cv)
├── 404.html            # terminal-style "command not found"
├── assets/
│   ├── styles.css      # shared stylesheet (GitHub-dark inspired)
│   ├── terminal.js     # typing engine + interactive prompt
│   ├── favicon.svg     # `>` glyph favicon
│   ├── og.svg          # social share image source (1200×630)
│   ├── og.png          # rendered social share image (used by og:image)
│   ├── cv.html         # CV source (terminal-dark theme, print-optimized)
│   └── cv.pdf          # CV rendered to PDF (served by the `cv` command)
├── CNAME               # custom domain for GitHub Pages
├── robots.txt
├── sitemap.xml
└── README.md
```

## Available terminal commands

Once a page finishes typing, an interactive prompt appears. Supported commands:

- `whoami` / `home` — go to the home page
- `experience` / `career` — career timeline
- `projects` / `work` — selected work
- `contact` / `contacts` — get in touch
- `cv` / `resume` — download CV
- `ls` — list sections
- `help`, `?` — show help
- `clear`, `Ctrl/Cmd+L` — clear the screen
- `cd <section>` — same as the section name
- `↑` / `↓` — navigate command history

## Local development

There is no build step. Open the file directly or serve the folder:

```bash
python3 -m http.server 5173
# then open http://localhost:5173
```

## Deploying to dmitry.popov.engineer

This repo is configured for **GitHub Pages** with a custom subdomain.

1. Push to GitHub (e.g. `dmitry-popov/dmitry-popov-engineer`, `main` branch).
2. Repository → **Settings → Pages** → Source: `Deploy from a branch`,
   Branch: `main` / root.
3. Pages will pick up the `CNAME` file and set the custom domain to
   `dmitry.popov.engineer`.
4. In your DNS provider for `popov.engineer`, add a record:

   ```
   Type   Name      Value
   CNAME  dmitry    dmitry-popov.github.io.
   ```

   (Replace `dmitry-popov` with your actual GitHub username if different.)
5. Wait for DNS to propagate, then enable **Enforce HTTPS** in Pages settings.

Alternative hosts (no code change needed):

- **Cloudflare Pages** — connect the repo, leave build command empty,
  output directory `/`. Add `dmitry.popov.engineer` as a custom domain.
- **Netlify** — drag-and-drop the folder or connect the repo, custom domain
  `dmitry.popov.engineer`.

## Regenerating the social share image

`assets/og.svg` is the editable source. Most social platforms (LinkedIn,
Twitter/X, Facebook, iMessage) don't support SVG for `og:image`, so the
site references `assets/og.png` instead. If you edit the SVG, regenerate
the PNG with headless Chrome:

```bash
cat > /tmp/og_wrap.html <<'HTML'
<!DOCTYPE html><meta charset="UTF-8">
<style>html,body{margin:0;width:1200px;height:630px;background:#0d1117}
img{display:block;width:1200px;height:630px}</style>
<img src="file://$PWD/assets/og.svg">
HTML

"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1200,630 --force-device-scale-factor=1 \
  --screenshot="$PWD/assets/og.png" file:///tmp/og_wrap.html
```

## Regenerating the CV PDF

The CV is authored as an HTML document in `assets/cv.html` using the same
terminal-dark theme as the site. `assets/cv.pdf` is rendered from it via
headless Chrome. The HTML stays the source of truth — edit it, then rebuild:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu \
  --no-pdf-header-footer --hide-scrollbars \
  --virtual-time-budget=3000 \
  --print-to-pdf="$PWD/assets/cv.pdf" \
  "file://$PWD/assets/cv.html"
```

Content in `assets/cv.html` should stay in sync with the site. When you
update `experience.html`, `projects.html` or `index.html`, mirror the
change into `cv.html` and regenerate the PDF.

## Updating content

- CV: edit `assets/cv.html`, then regenerate `assets/cv.pdf` (see above).
- Career: edit the `lines` array at the bottom of `experience.html`.
- Projects: edit the `lines` array at the bottom of `projects.html`.
- Stack/role: edit the `lines` array at the bottom of `index.html`.

Each `lines` entry is one of:

- `{ kind: "gap" }` — blank line
- `{ kind: "cmd",  text: "ls" }` — typed prompt + command
- `{ kind: "out",  html: "..." }` — output line (HTML allowed; use the
  `tok-key`, `tok-string`, `tok-accent`, `tok-muted`, `tok-error` classes
  for syntax-style colours)

## Accessibility

- Honors `prefers-reduced-motion`: typing animation is skipped and the
  cursor stops blinking for users who opt out.
- Focus-visible outlines on links.
- All decorative window chrome is `aria-hidden`.

## License

Engine code (HTML/CSS/JS) — MIT. Content (personal info, CV, copy) — © Dmitry Popov, all rights reserved.
