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
     red    -> ends the session: logout, then a blinking cursor and a hint;
               any key or click restarts the session
     yellow -> pauses the terminal and shows the static page instead
     green  -> full screen, with the section tabs kept at the bottom */

  let activeSession = null;
  let lastBootOpts = null;
  let bootGen = 0;
  let screenWired = false;
  let readingEl = null;

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
        if (document.body.classList.contains("is-closed")) {
          openSession();
          return;
        }
        const input = activeSession && activeSession.activeInput;
        if (!input) return;
        input.focus();
        moveCaretToEnd(input);
      },
      { passive: true }
    );
  }

  // The static page shown in pause mode is the same markup as the <noscript>
  // fallback, moved into a hidden container on first use (one source of truth).
  function ensureReading() {
    if (readingEl) return readingEl;
    const win = terminalWindow();
    const fallback = document.querySelector("noscript");
    if (!win || !fallback) return null;

    readingEl = el("div", "reading");
    readingEl.id = "reading";
    readingEl.tabIndex = -1;
    readingEl.innerHTML = fallback.textContent;
    win.appendChild(readingEl);
    return readingEl;
  }

  function showClosedScreen(screen) {
    screen.innerHTML = "";
    screen.setAttribute("aria-busy", "false");
    const line = el("div", "line");
    line.innerHTML =
      '<span class="cursor"></span>' +
      '<span class="tok-muted"> press any key to reconnect</span>';
    screen.appendChild(line);
  }

  function closeSession() {
    if (document.body.classList.contains("is-closed")) return;

    const screen = document.getElementById("screen");
    const win = terminalWindow();
    bootGen++; // stops any typing still in flight
    if (activeSession) activeSession.activeInput = null;
    togglePause(false, true); // exit and pause are mutually exclusive
    if (document.body.classList.contains("is-zoomed")) toggleZoom(false, true);

    // Keep the window size so the session looks switched off, not shrunk.
    if (win) {
      win.style.height = win.offsetHeight + "px";
    }

    if (screen) {
      printCmdEcho(screen, "logout");
      printOut(
        screen,
        '<span class="tok-muted">Connection to popov.engineer closed.</span>'
      );
    }

    const finish = () => {
      if (screen) showClosedScreen(screen);
      document.body.classList.add("is-closed");
      announce("Session closed. Press any key or click to reconnect.");
    };

    if (prefersReducedMotion()) finish();
    else setTimeout(finish, 700);
  }

  function openSession() {
    if (!document.body.classList.contains("is-closed")) return;
    document.body.classList.remove("is-closed");

    const screen = document.getElementById("screen");
    const win = terminalWindow();
    if (win) win.style.height = "";
    if (screen) {
      screen.innerHTML = "";
      screen.inert = false;
      screen.removeAttribute("aria-hidden");
    }

    announce("Session restored.");
    bootTerminal(lastBootOpts || {});
  }

  function togglePause(force, silent) {
    const paused =
      force === undefined
        ? !document.body.classList.contains("is-paused")
        : !!force;
    if (paused) ensureReading();
    document.body.classList.toggle("is-paused", paused);

    const button = document.querySelector(".dot.min");
    if (button) button.setAttribute("aria-pressed", String(paused));
    if (silent) return;

    if (paused) {
      announce("Paused. Showing the static page.");
      if (readingEl) readingEl.focus({ preventScroll: true });
    } else {
      announce("Terminal resumed.");
      const input = activeSession && activeSession.activeInput;
      if (input) input.focus({ preventScroll: true });
    }
  }

  function toggleZoom(force, silent) {
    const zoomed =
      force === undefined
        ? !document.body.classList.contains("is-zoomed")
        : !!force;
    document.body.classList.toggle("is-zoomed", zoomed);
    const button = document.querySelector(".dot.zoom");
    if (button) button.setAttribute("aria-pressed", String(zoomed));
    if (!silent) {
      announce(zoomed ? "Window expanded." : "Window restored.");
    }
  }

  function initChrome() {
    const close = document.querySelector(".dot.close");
    const min = document.querySelector(".dot.min");
    const zoom = document.querySelector(".dot.zoom");

    if (close) close.addEventListener("click", closeSession);
    if (min) min.addEventListener("click", () => togglePause());
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
