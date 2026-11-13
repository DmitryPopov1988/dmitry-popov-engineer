/**
 * Terminal engine for dmitry.popov.engineer
 *
 * Renders a fake shell session: types lines char-by-char, then mounts an
 * interactive prompt with a small command set used as site navigation.
 *
 * Public API:
 *   bootTerminal({ page, lines })
 *     page  -- current page id ('whoami' | 'experience' | 'projects' | 'contact' | '404');
 *            sets #screen aria-label when recognised
 *     lines -- array of line descriptors:
 *       { kind: 'gap' }
 *       { kind: 'cmd',  text: 'whoami' }
 *       { kind: 'out',  html: '...' }                 // raw html allowed (caller controls it)
 *       { kind: 'meta', text: 'Last login: ...' }
 */

(function () {
  "use strict";

  const ROUTES = {
    whoami: "/",
    about: "/",
    home: "/",
    experience: "/experience.html",
    career: "/experience.html",
    projects: "/projects.html",
    work: "/projects.html",
    contact: "/contact.html",
    contacts: "/contact.html",
  };

  const PAGE_LABELS = {
    whoami: "whoami",
    experience: "experience",
    projects: "projects",
    contact: "contact",
    "404": "404",
  };

  const CV_PATH = "/assets/cv.pdf";

  const HELP_HTML = [
    '<span class="tok-muted">Available commands:</span>',
    '  <span class="tok-key">whoami</span>      go to home',
    '  <span class="tok-key">experience</span>  career timeline',
    '  <span class="tok-key">projects</span>    selected work',
    '  <span class="tok-key">contact</span>     how to reach me',
    '  <span class="tok-key">cv</span>          download CV (PDF)',
    '  <span class="tok-key">ls</span>          list sections',
    '  <span class="tok-key">clear</span>       clear the screen',
    '  <span class="tok-key">help</span>        show this message',
    '<span class="tok-muted">Tip: <span class="tok-accent">cd projects</span> works too. Use ↑/↓ for history.</span>',
  ].join("\n");

  // Live, reactive check: the OS preference can change while the page is open.
  const reducedMotionMedia =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)");

  function prefersReducedMotion() {
    return !!(reducedMotionMedia && reducedMotionMedia.matches);
  }

  const TYPE_SPEED = 14;        // ms per char
  const LINE_DELAY = 90;        // ms between lines
  const META_SPEED = 6;         // type meta-line a bit faster

  function el(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function ps1Html() {
    return (
      '<span class="tok-prompt">dmitry@popov.engineer</span>' +
      '<span class="tok-muted">:</span>' +
      '<span class="tok-key">~</span>' +
      '<span class="tok-muted">$</span>'
    );
  }

  function formatDate() {
    // Locale-independent "Tue Nov 13 2026 21:17:48" — no timezone suffix.
    const now = new Date();
    const date = now.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const time = now.toLocaleTimeString("en-US", { hour12: false });
    return (date + " " + time).replace(/,/g, "");
  }

  function renderLineNode(line) {
    const node = el("div", "line");
    if (line.kind === "gap") {
      node.classList.add("gap");
      return node;
    }
    if (line.kind === "meta") {
      node.classList.add("tok-muted");
      return node;
    }
    if (line.kind === "cmd") {
      node.innerHTML = ps1Html() + " ";
      const cmdSpan = el("span", "tok-cmd");
      node.appendChild(cmdSpan);
      node._cmdSpan = cmdSpan;
      return node;
    }
    return node; // 'out'
  }

  function typeText(target, text, speed) {
    return new Promise((resolve) => {
      if (prefersReducedMotion() || !text) {
        target.textContent = text || "";
        return resolve();
      }
      let i = 0;
      const tick = () => {
        target.textContent += text.charAt(i++);
        if (i < text.length) setTimeout(tick, speed);
        else resolve();
      };
      tick();
    });
  }

  function typeHtml(target, html) {
    // For 'out' lines we set HTML at once (links and tokens need to be live).
    // Animation is achieved by gradually revealing characters using a temp clone.
    return new Promise((resolve) => {
      if (prefersReducedMotion() || !html) {
        target.innerHTML = html || "";
        return resolve();
      }
      const tmp = el("div", null, html);
      const fullText = tmp.textContent;
      // Type plain text first, then swap to formatted html. Cheap and looks fine.
      let i = 0;
      const tick = () => {
        target.textContent = fullText.slice(0, ++i);
        if (i < fullText.length) {
          setTimeout(tick, TYPE_SPEED);
        } else {
          target.innerHTML = html;
          resolve();
        }
      };
      tick();
    });
  }

  function scrollToBottom(screen) {
    screen.scrollTop = screen.scrollHeight;
  }

  function appendCursor(node) {
    const c = el("span", "cursor");
    node.appendChild(c);
    return c;
  }

  async function playLines(screen, lines, gen) {
    screen.setAttribute("aria-busy", "true");
    try {
      for (let idx = 0; idx < lines.length; idx++) {
        // A newer boot (or a closed session) supersedes this one.
        if (gen !== undefined && gen !== bootGen) return;
        const line = lines[idx];
        const node = renderLineNode(line);
        screen.appendChild(node);

        if (line.kind === "gap") {
          // nothing to type
        } else if (line.kind === "meta") {
          const cursor = appendCursor(node);
          await typeText(node, line.text || "", META_SPEED);
          cursor.remove();
        } else if (line.kind === "cmd") {
          const cursor = appendCursor(node);
          await typeText(node._cmdSpan, line.text || "", TYPE_SPEED);
          cursor.remove();
        } else if (line.kind === "out") {
          const cursor = appendCursor(node);
          await typeHtml(node, line.html || "");
          // typeHtml replaces innerHTML, so cursor is gone already
          cursor.remove();
        }

        scrollToBottom(screen);

        if (!prefersReducedMotion() && idx < lines.length - 1) {
          await new Promise((r) => setTimeout(r, LINE_DELAY));
        }
      }
    } finally {
      screen.setAttribute("aria-busy", "false");
    }
  }

  function navigate(target) {
    window.location.href = target;
  }

  function downloadCv(screen) {
    // Trigger the download through a transient anchor element.
    const a = document.createElement("a");
    a.href = CV_PATH;
    a.download = "Dmitry_Popov_CV.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    printOut(
      screen,
      '<span class="tok-muted">downloading </span>' +
        '<a class="terminal-link" href="' +
        CV_PATH +
        '" download>Dmitry_Popov_CV.pdf</a>' +
        '<span class="tok-muted"> ...</span>'
    );
  }

  function printCmdEcho(screen, text) {
    const node = el("div", "line");
    node.innerHTML = ps1Html() + ' <span class="tok-cmd"></span>';
    node.querySelector(".tok-cmd").textContent = text;
    screen.appendChild(node);
  }

  function printOut(screen, html) {
    const node = el("div", "line");
    node.innerHTML = html;
    screen.appendChild(node);
    scrollToBottom(screen);
  }

  function clearScreen(screen, session) {
    if (session && session.bootHtml != null) {
      screen.innerHTML = session.bootHtml;
    } else {
      screen.innerHTML = "";
    }
  }

  function handleCommand(screen, raw, session) {
    const input = (raw || "").trim();
    if (!input) {
      printCmdEcho(screen, "");
      return;
    }
    printCmdEcho(screen, input);

    // Tokenize: drop leading "cd " if present
    let tokens = input.split(/\s+/);
    if (tokens[0] === "cd" && tokens.length > 1) tokens = tokens.slice(1);
    const cmd = tokens[0].toLowerCase();
    const arg = tokens.slice(1).join(" ");

    if (cmd === "help" || cmd === "?") {
      printOut(screen, HELP_HTML);
      return;
    }
    if (cmd === "ls") {
      printOut(
        screen,
        '<span class="tok-key">whoami</span>      ' +
          '<span class="tok-key">experience</span>  ' +
          '<span class="tok-key">projects</span>    ' +
          '<span class="tok-key">contact</span>     ' +
          '<span class="tok-key">cv</span>'
      );
      return;
    }
    if (cmd === "clear") {
      clearScreen(screen, session);
      return;
    }
    if (cmd === "cv" || cmd === "resume") {
      downloadCv(screen);
      return;
    }
    if (cmd === "echo") {
      printOut(screen, escapeHtml(arg));
      return;
    }
    if (cmd === "pwd") {
      printOut(screen, "/home/dmitry");
      return;
    }
    if (cmd === "date") {
      printOut(screen, escapeHtml(new Date().toString()));
      return;
    }
    if (cmd === "exit" || cmd === "logout") {
      printOut(
        screen,
        '<span class="tok-muted">Connection to popov.engineer closed.</span>'
      );
      return;
    }
    if (cmd === "sudo") {
      printOut(
        screen,
        '<span class="tok-error">Permission denied:</span> nice try.'
      );
      return;
    }
    if (ROUTES[cmd]) {
      printOut(
        screen,
        '<span class="tok-muted">opening </span><span class="tok-key">' +
          cmd +
          '</span><span class="tok-muted"> ...</span>'
      );
      setTimeout(() => navigate(ROUTES[cmd]), 180);
      return;
    }
    printOut(
      screen,
      '<span class="tok-error">command not found:</span> ' +
        escapeHtml(cmd) +
        '\n<span class="tok-muted">type </span>' +
        '<span class="tok-key">help</span>' +
        '<span class="tok-muted"> for the list of commands</span>'
    );
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* Theming lives entirely in assets/theme-boot.js: the palette follows the
     visitor's local clock, so there is nothing to toggle or persist here. */

  /* ---- Window chrome (traffic lights) -----------------------------------
     close    -> ends the session, then shows a desktop with a reconnect icon
     minimize -> collapses the window down to its title bar
     zoom     -> expands the window to fill the viewport (Esc also exits) */

  let activeSession = null;
  let lastBootOpts = null;
  let bootGen = 0;
  let screenWired = false;
  let desktopEl = null;

  function announce(message) {
    const status = document.getElementById("terminal-status");
    if (status) status.textContent = message;
  }

  function terminalWindow() {
    return document.getElementById("main-content");
  }

  // The screen survives reboots, so its click handler is wired only once and
  // always talks to the session that is currently mounted.
  function wireScreenClick(screen) {
    if (screenWired) return;
    screenWired = true;
    screen.addEventListener(
      "click",
      (ev) => {
        if (ev.target.closest("a")) return;
        const input = activeSession && activeSession.activeInput;
        if (!input) return;
        input.focus();
        moveCaretToEnd(input);
      },
      { passive: true }
    );
  }

  function buildDesktop() {
    const wrap = el("div", "desktop");
    wrap.id = "desktop";
    wrap.hidden = true;

    const button = el("button", "desktop-icon");
    button.type = "button";
    button.id = "reconnect";
    button.innerHTML =
      '<svg class="desktop-icon-glyph" viewBox="0 0 24 24" aria-hidden="true">' +
      '<rect x="2.75" y="3.75" width="18.5" height="14.5" rx="2.5"/>' +
      '<path d="M6.6 8.9 9.3 11l-2.7 2.1M11.5 13.1h5.5"/></svg>' +
      '<span class="desktop-label">terminal</span>';

    const hint = el(
      "p",
      "desktop-hint",
      "Click anywhere or press any key to reconnect"
    );

    wrap.appendChild(button);
    wrap.appendChild(hint);
    wrap.addEventListener("click", openSession);
    document.body.appendChild(wrap);
    return wrap;
  }

  function resetWindowState() {
    const win = terminalWindow();
    if (win) {
      win.classList.remove("is-minimized");
      win.style.height = "";
    }
    document.body.classList.remove("is-zoomed");
    const min = document.querySelector(".dot.min");
    const zoom = document.querySelector(".dot.zoom");
    if (min) min.setAttribute("aria-pressed", "false");
    if (zoom) zoom.setAttribute("aria-pressed", "false");
  }

  function closeSession() {
    const screen = document.getElementById("screen");
    bootGen++; // stops any typing still in flight
    if (activeSession) activeSession.activeInput = null;

    if (screen) {
      printCmdEcho(screen, "logout");
      printOut(
        screen,
        '<span class="tok-muted">Connection to popov.engineer closed.</span>'
      );
    }

    const finish = () => {
      resetWindowState();
      document.body.classList.add("is-closed");

      if (!desktopEl) desktopEl = buildDesktop();
      desktopEl.hidden = false;

      const button = document.getElementById("reconnect");
      if (button) button.focus({ preventScroll: true });
      announce("Session closed. Click anywhere or press any key to reconnect.");
    };

    if (prefersReducedMotion()) finish();
    else setTimeout(finish, 600);
  }

  function openSession() {
    if (!document.body.classList.contains("is-closed")) return;
    if (desktopEl) desktopEl.hidden = true;
    document.body.classList.remove("is-closed");

    const screen = document.getElementById("screen");
    if (screen) {
      screen.innerHTML = "";
      screen.inert = false;
      screen.removeAttribute("aria-hidden");
    }

    resetWindowState();
    announce("Session restored.");
    bootTerminal(lastBootOpts || {});
  }

  function setCollapsed(collapsed) {
    const win = terminalWindow();
    if (!win) return;

    const bar = win.querySelector(".topbar");
    const barHeight = bar ? Math.ceil(bar.getBoundingClientRect().height) : 34;
    const screen = document.getElementById("screen");

    if (collapsed) {
      if (document.body.classList.contains("is-zoomed")) toggleZoom(false);
      win.style.height = win.offsetHeight + "px";
      win.classList.add("is-minimized");
      win.style.height = barHeight + "px";
      if (screen) {
        screen.inert = true;
        screen.setAttribute("aria-hidden", "true");
      }
      if (activeSession && activeSession.activeInput) {
        activeSession.activeInput.blur();
      }
      announce("Window minimized.");
    } else {
      win.classList.remove("is-minimized");
      if (screen) {
        screen.inert = false;
        screen.removeAttribute("aria-hidden");
      }
      win.style.height = "";
      const natural = win.offsetHeight;
      win.style.height = barHeight + "px";
      win.style.height = natural + "px";
      setTimeout(
        () => {
          if (!win.classList.contains("is-minimized")) win.style.height = "";
        },
        prefersReducedMotion() ? 0 : 260
      );
      announce("Window restored.");
    }
  }

  function toggleMinimize() {
    const win = terminalWindow();
    if (!win) return;
    const minimize = !win.classList.contains("is-minimized");
    setCollapsed(minimize);
    const button = document.querySelector(".dot.min");
    if (button) button.setAttribute("aria-pressed", String(minimize));
  }

  function toggleZoom(force) {
    const zoomed =
      force === undefined
        ? !document.body.classList.contains("is-zoomed")
        : !!force;
    document.body.classList.toggle("is-zoomed", zoomed);
    const button = document.querySelector(".dot.zoom");
    if (button) button.setAttribute("aria-pressed", String(zoomed));
    announce(zoomed ? "Window expanded to full screen." : "Window restored.");
  }

  function initChrome() {
    const close = document.querySelector(".dot.close");
    const min = document.querySelector(".dot.min");
    const zoom = document.querySelector(".dot.zoom");

    if (close) close.addEventListener("click", closeSession);
    if (min) min.addEventListener("click", toggleMinimize);
    if (zoom) zoom.addEventListener("click", () => toggleZoom());

    document.addEventListener("keydown", (ev) => {
      if (document.body.classList.contains("is-closed")) {
        // Don't swallow browser shortcuts (Cmd/Ctrl+W, +R, +L, +T) or bare
        // modifier keypresses — only plain keys should reconnect.
        if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
        if (ev.key === "Tab" || ev.key === "Shift" || ev.key === "CapsLock") {
          return;
        }
        ev.preventDefault();
        openSession();
        return;
      }
      if (ev.key === "Escape" && document.body.classList.contains("is-zoomed")) {
        toggleZoom(false);
      }
    });
  }

  function announceReady() {
    const status = document.getElementById("terminal-status");
    if (status) {
      status.textContent = "Content loaded. Terminal ready for commands.";
    }
  }

  function mountPrompt(screen, session, focus) {
    const wrap = el("div", "input-line");
    const ps1 = el("span", "ps1");
    ps1.innerHTML = ps1Html();

    // Use contenteditable instead of <input> so Safari does not show its
    // AutoFill / Passwords key icon over the prompt. As a bonus the caret
    // matches the monospace metrics exactly and there are no native paddings.
    const input = el("span", "cmd-input");
    input.setAttribute("contenteditable", "plaintext-only");
    input.setAttribute("role", "textbox");
    input.setAttribute("aria-label", "terminal command input");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("enterkeyhint", "go");
    // Help password managers / autofill skip this element.
    input.setAttribute("data-1p-ignore", "");
    input.setAttribute("data-lpignore", "true");
    input.setAttribute("data-bwignore", "true");
    input.setAttribute("data-form-type", "other");

    wrap.appendChild(ps1);
    wrap.appendChild(input);
    screen.appendChild(wrap);
    scrollToBottom(screen);
    session.activeInput = input;
    if (focus) {
      input.focus({ preventScroll: true });
      moveCaretToEnd(input);
    }

    function getValue() {
      return input.textContent || "";
    }

    function setValue(text) {
      input.textContent = text;
      moveCaretToEnd(input);
    }

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault(); // never insert a newline
        const value = getValue();
        if (value.trim()) {
          session.history.push(value);
          session.hIdx = session.history.length;
        }
        wrap.remove();
        handleCommand(screen, value, session);
        mountPrompt(screen, session, true);
      } else if (e.key === "ArrowUp") {
        if (session.history.length === 0) return;
        e.preventDefault();
        session.hIdx = Math.max(0, session.hIdx - 1);
        setValue(session.history[session.hIdx] || "");
      } else if (e.key === "ArrowDown") {
        if (session.history.length === 0) return;
        e.preventDefault();
        session.hIdx = Math.min(session.history.length, session.hIdx + 1);
        setValue(session.history[session.hIdx] || "");
      } else if (e.key === "l" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        clearScreen(screen, session);
        mountPrompt(screen, session, true);
      }
    });

    // Force plain-text paste in browsers that ignore plaintext-only.
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData(
        "text/plain"
      );
      insertTextAtSelection(text);
    });
  }

  function insertTextAtSelection(text) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function moveCaretToEnd(node) {
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
  }

  async function bootTerminal(opts) {
    const screen = document.getElementById("screen");
    if (!screen) return;

    lastBootOpts = opts || {};
    const gen = ++bootGen;

    const page = opts && opts.page;
    if (page && PAGE_LABELS[page]) {
      screen.setAttribute("aria-label", "Terminal output — " + PAGE_LABELS[page]);
    }
    const session = { history: [], hIdx: 0, activeInput: null, bootHtml: null };
    activeSession = session;
    wireScreenClick(screen);
    const lines = (opts && opts.lines) || [];
    const intro = [
      { kind: "meta", text: `Last login: ${formatDate()} on console` },
      { kind: "gap" },
    ];
    await playLines(screen, intro.concat(lines), gen);
    if (gen !== bootGen) return;
    session.bootHtml = screen.innerHTML;
    mountPrompt(screen, session, true);
    announceReady();
  }

  initChrome();

  window.bootTerminal = bootTerminal;
  window.escapeHtml = escapeHtml;
})();
