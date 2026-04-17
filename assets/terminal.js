/**
 * Terminal engine for dmitry.popov.engineer
 *
 * Renders a fake shell session: types lines char-by-char, then mounts an
 * interactive prompt with a small command set used as site navigation.
 *
 * Public API:
 *   bootTerminal({ page, lines })
 *     page  -- current page id ('whoami' | 'experience' | 'projects' | 'contact' | '404')
 *     lines -- array of line descriptors:
 *       { kind: 'gap' }
 *       { kind: 'cmd',  text: 'whoami' }
 *       { kind: 'out',  html: '...' }                 // raw html allowed (caller controls it)
 *       { kind: 'meta', text: 'Last login: ...' }
 */

(function () {
  "use strict";

  const ROUTES = {
    whoami: "index.html",
    about: "index.html",
    home: "index.html",
    experience: "experience.html",
    career: "experience.html",
    projects: "projects.html",
    work: "projects.html",
    contact: "contact.html",
    contacts: "contact.html",
  };

  const CV_PATH = "assets/cv.pdf";

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

  const reducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    return new Date().toString().replace(/\sGMT.*$/, "").trim();
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
      if (reducedMotion || !text) {
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
      if (reducedMotion || !html) {
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

  function removeCursor(node) {
    const c = node.querySelector(".cursor");
    if (c) c.remove();
  }

  async function playLines(screen, lines) {
    for (let idx = 0; idx < lines.length; idx++) {
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
        removeCursor(node);
        cursor.remove();
      }

      scrollToBottom(screen);

      if (!reducedMotion && idx < lines.length - 1) {
        await new Promise((r) => setTimeout(r, LINE_DELAY));
      }
    }
  }

  function navigate(target) {
    window.location.href = target;
  }

  function downloadCv(screen) {
    // Trigger download in a hidden iframe-like anchor
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

  function printGap(screen) {
    screen.appendChild(el("div", "line gap"));
  }

  function clearScreen(screen) {
    screen.innerHTML = "";
  }

  function handleCommand(screen, raw) {
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
        [
          '<span class="tok-key">whoami</span>      ' +
            '<span class="tok-key">experience</span>  ' +
            '<span class="tok-key">projects</span>    ' +
            '<span class="tok-key">contact</span>     ' +
            '<span class="tok-key">cv</span>',
        ].join("\n")
      );
      return;
    }
    if (cmd === "clear") {
      clearScreen(screen);
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

  function mountPrompt(screen) {
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

    const history = [];
    let hIdx = 0;

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
          history.push(value);
          hIdx = history.length;
        }
        wrap.remove();
        handleCommand(screen, value);
        mountPrompt(screen);
      } else if (e.key === "ArrowUp") {
        if (history.length === 0) return;
        e.preventDefault();
        hIdx = Math.max(0, hIdx - 1);
        setValue(history[hIdx] || "");
      } else if (e.key === "ArrowDown") {
        if (history.length === 0) return;
        e.preventDefault();
        hIdx = Math.min(history.length, hIdx + 1);
        setValue(history[hIdx] || "");
      } else if (e.key === "l" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        clearScreen(screen);
        mountPrompt(screen);
      }
    });

    // Force plain-text paste in browsers that ignore plaintext-only.
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData(
        "text/plain"
      );
      document.execCommand("insertText", false, text);
    });

    // Focus on click anywhere in the screen
    screen.addEventListener(
      "click",
      (ev) => {
        // Don't steal focus from real links
        if (ev.target.closest("a")) return;
        input.focus();
        moveCaretToEnd(input);
      },
      { passive: true }
    );

    input.focus({ preventScroll: true });
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
    const lines = (opts && opts.lines) || [];
    const intro = [
      { kind: "meta", text: `Last login: ${formatDate()} on console` },
      { kind: "gap" },
    ];
    await playLines(screen, intro.concat(lines));
    mountPrompt(screen);
  }

  window.bootTerminal = bootTerminal;
})();
