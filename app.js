/**
 * HeLa MCP Ecosystem — Documentation Engine
 * Canonical data: config/inventory.json (mirrored here for static hosting).
 * Covers: client configurator, command palette, copy buttons.
 */

// hela:inventory:start
const { inventory: INVENTORY, profiles: PROFILES } = globalThis.HELA_DOCS_DATA;
// hela:inventory:end

function renderConfig(profileKey, clientKey) {
  const selectedProfile = profileKey || "minimal";
  const root = "/absolute/path/to/MCPservers";
  const runtimePath = root + "/hela-runtime/dist/index.js";
  const runtimeEnv = { HELA_PROFILE: selectedProfile, HELA_ECOSYSTEM_ROOT: root + "/hela-mcp-ecosystem" };

  if (["cursor", "claude", "gemini", "antigravity"].includes(clientKey)) {
    return JSON.stringify({ mcpServers: { "hela-runtime": { command: "node", args: [runtimePath], env: runtimeEnv } } }, null, 2);
  }
  if (clientKey === "opencode" || clientKey === "kilo") {
    return JSON.stringify({ mcp: { "hela-runtime": { type: "local", enabled: true, command: ["node", runtimePath], environment: runtimeEnv } } }, null, 2);
  }
  if (clientKey === "zed") {
    return JSON.stringify({ context_servers: { "hela-runtime": { command: "node", args: [runtimePath], env: runtimeEnv } } }, null, 2);
  }
  if (clientKey === "codex") {
    return `# Generated Codex / ChatGPT MCP Server Configuration\n\n[mcp_servers.hela-runtime]\ncommand = "node"\nargs = [${JSON.stringify(runtimePath)}]\n\n[mcp_servers.hela-runtime.env]\nHELA_PROFILE = ${JSON.stringify(selectedProfile)}\nHELA_ECOSYSTEM_ROOT = ${JSON.stringify(runtimeEnv.HELA_ECOSYSTEM_ROOT)}\n`;
  }
  if (clientKey === "docker") {
    return JSON.stringify({ services: { "hela-runtime": {
      image: "hela-ecosystem:" + selectedProfile + "-" + globalThis.HELA_DOCS_DATA.release.ecosystem,
      init: true, stdin_open: true, tty: false, working_dir: "/workspace",
      command: ["node", "/opt/hela/hela-runtime/dist/index.js"],
      environment: { HELA_PROFILE: selectedProfile, HELA_ECOSYSTEM_ROOT: "/opt/hela/hela-mcp-ecosystem" },
      volumes: ["hela-runtime-data:/data", "workspace:/workspace"],
    } }, volumes: { "hela-runtime-data": {}, workspace: {} } }, null, 2);
  }
  return "// Select a profile and client.";
}

function renderAgentPrompt(profileKey, clientKey) {
  const profKey = profileKey || "minimal";
  const client = clientKey || "cursor";
  const prof = PROFILES?.[profKey] || { name: "HeLa Minimal", servers: [] };
  const profileChoices = Object.entries(PROFILES || {})
    .map(([id, profile]) => `   - ${id}: ${profile.name || id}`)
    .join("\n");

  return `Please autonomously install and configure the HeLa Cellular MCP Ecosystem through one profile-aware hela-runtime MCP endpoint:

1. System & Environment Check:
   - Ensure Node.js (>= 22.x LTS recommended, min 20.18.1), Git (>= 2.30.0), and build tools are available.
   - Target client: ${client}.

2. Confirm the profile with the user before installing:
   - Show the quick profile catalog: https://hela.my.id/profiles.html
   - For detailed persona, workflow, server membership, and prerequisite explanations, show: https://hela.my.id/library/docs/profiles.html
   - Ask which profile best fits the user's work, and present these choices:
${profileChoices}
   - The configurator suggestion is ${profKey} (${prof.name || profKey}); treat it as a suggestion only and accept a different profile.
   - If the user does not choose, use minimal. Do not run setup until the profile is confirmed; call the confirmed id <confirmed_profile>.

3. Clone & Install the Managed Runtime:
   git clone https://github.com/Hela-Ecosystem/hela-mcp-ecosystem.git
   cd hela-mcp-ecosystem
   Linux/macOS: node setup.mjs --profile <confirmed_profile> --client ${client} --mode runtime --non-interactive
   Windows PowerShell: .\\setup.ps1 --profile <confirmed_profile> --client ${client} --mode runtime --non-interactive
   Windows Command Prompt: setup.cmd --profile <confirmed_profile> --client ${client} --mode runtime --non-interactive
   Run the matching doctor command through the same entrypoint.
   Safely merge the generated ${client} configuration fragment into my active ${client} MCP settings.
   Do not deploy or configure each hela-* cell as a separate client server.

4. Synchronize Companion Skills:
   Copy/link active skills matching <confirmed_profile> from the ecosystem into ~/.agents/skills/ (e.g., guardian-*, code-reviewer, skill-finder, ui-designer, browser-agent).

5. Load the Runtime Profile Context (HELA_PROFILE=<confirmed_profile>):
   - Do not create or copy a static persona prompt into the workspace.
   - After connecting, read the runtime resource hela://profile/context or request the hela-profile-bootstrap MCP prompt.
   - Use only the organelles and tools exposed by that selected profile; the runtime is the authority.

5. Final Handshake:
   Initialize the workspace memory graph through the exposed Genome tool when that organelle is active, and confirm the selected profile plus ready runtime tools.`;
}

const isIdPage = (typeof document !== "undefined" && (document.documentElement.lang === "id" || window.location.pathname.includes("/id/")));
const pagePrefix = typeof document !== "undefined" ? document.body?.dataset?.pagePrefix || "" : "";

const PAGES = isIdPage ? [
  { title: "01 Ikhtisar", link: "index.html" },
  { title: "04 Arsitektur", link: "architecture.html" },
  { title: "05 Alur Kerja", link: "workflows.html" },
  { title: "06 Profil & Konfigurasi", link: "profiles.html" },
  { title: "07 Pameran & Demo", link: "showcase.html" },
  { title: "08 Diagnostik", link: "troubleshooting.html" },
  { title: "09 Privasi", link: "privacy.html" },
  { title: "10 Ketentuan", link: "terms.html" },
  { title: "Pustaka dokumentasi", link: "library.html" }
] : [
  { title: "01 Overview", link: "index.html" },
  { title: "04 Architecture", link: "architecture.html" },
  { title: "05 Workflows", link: "workflows.html" },
  { title: "06 Profiles and Config", link: "profiles.html" },
  { title: "07 Showcase", link: "showcase.html" },
  { title: "08 Diagnostics", link: "troubleshooting.html" },
  { title: "09 Privacy", link: "privacy.html" },
  { title: "10 Terms", link: "terms.html" },
  { title: "Document library", link: "library.html" }
];


const I18N = {
  en: {
    "topbar.search": "Search",
    "nav.overview": "Overview",
    "nav.installation": "Installation",
    "nav.verify": "Verify",
    "nav.architecture": "Architecture",
    "nav.workflows": "Workflows",
    "nav.profiles": "Profiles & Config",
    "nav.showcase": "Showcase",
    "nav.diagnostics": "Diagnostics",
    "nav.privacy": "Privacy",
    "nav.terms": "Terms",
    "nav.section.started": "GETTING STARTED",
    "nav.section.reference": "REFERENCE",
    "nav.section.operate": "OPERATE",
    "nav.section.legal": "LEGAL",
    "index.title": "HeLa Cellular MCP Workbench",
    "index.lead": "A reproducible, 10-server MCP distribution suite for AI agents. Dual-backbone orchestration (reasoning + memory), deterministic stdio transport, and per-profile client configuration across 8 agent harnesses.",
    "index.what_title": "What this is",
    "index.what_desc": "Ten specialized servers, each a biological cell with one job. Two backbones coordinate them: <strong>HeLa Mitosis</strong> (task reasoning and routing) and <strong>HeLa Genome</strong> (persistent memory graph). The remaining eight cells provide filesystem, execution, processes, research, browser and image perception, design, mobile, and 3D capabilities.",
    "index.install_title": "Installation",
    "index.verify_title": "Verify",
    "index.verify_desc": "Three gates, all expected green before use:",
    "profiles.title": "Profiles & Config",
    "profiles.lead": "Eight deployment profiles. Preview a client configuration below; use the CLI to generate the installed configuration. The CLI matrix checks 80 profile/backend combinations.",
    "profiles.matrix_title": "Profile matrix",
    "profiles.configurator_title": "Configuration workbench",
    "profiles.label_profile": "Target profile",
    "profiles.label_client": "Client harness",
    "arch.title": "Architecture",
    "arch.lead": "Two backbones coordinate ten cells over standard MCP stdio (JSON-RPC 2.0). Mitosis routes and plans; Genome remembers. Every other cell is single-purpose.",
    "arch.backbones_title": "The dual backbone",
    "arch.servers_title": "Server reference",
    "arch.transport_title": "Transport",
    "arch.keys_title": "API keys",
    "workflows.title": "Workflows",
    "workflows.lead": "Six cross-cell workflow recipes. Each combines Mitosis planning, Genome memory, and specialized tools; required hardware and providers need separate verification.",
    "diag.title": "Diagnostics",
    "diag.lead": "How to diagnose, inspect, and repair any cell in the ecosystem. From the single-command doctor report to known failure modes and verified fixes.",
    "showcase.title": "Showcase",
    "showcase.lead": "Recorded verification gates and a production deployment synthesized end-to-end by the ecosystem. Proof that the cells operate together as advertised.",
    "privacy.title": "Privacy Policy",
    "privacy.lead": "Effective 2026-09-21. Short version: this site collects nothing. The software runs on your machine. We do not want your data.",
    "terms.title": "Terms of Use",
    "terms.lead": "Effective 2026-09-21. Short version: this is MIT-licensed open source software provided as-is. You run it; you are responsible for what it does."
  },
  id: {
    "topbar.search": "Cari",
    "nav.overview": "Ikhtisar",
    "nav.installation": "Instalasi",
    "nav.verify": "Verifikasi",
    "nav.architecture": "Arsitektur",
    "nav.workflows": "Alur Kerja",
    "nav.profiles": "Profil & Konfigurasi",
    "nav.showcase": "Pameran",
    "nav.diagnostics": "Diagnostik",
    "nav.privacy": "Privasi",
    "nav.terms": "Ketentuan",
    "nav.section.started": "MEMULAI",
    "nav.section.reference": "REFERENSI",
    "nav.section.operate": "PENGOPERASIAN",
    "nav.section.legal": "LEGAL & HUKUM",
    "index.title": "Meja Kerja Seluler HeLa MCP",
    "index.lead": "Rangkaian distribusi 10 server MCP yang dapat direproduksi untuk agen AI. Orkestrasi dual-backbone (penalaran + memori), transport stdio deterministik, dan konfigurasi klien per-profil di 8 harness agen.",
    "index.what_title": "Tentang Ekosistem Ini",
    "index.what_desc": "Sepuluh server terspesialisasi, masing-masing bertindak layaknya sel biologis dengan satu tugas utama. Dua backbone mengoordinasikannya: <strong>HeLa Mitosis</strong> (penalaran & perutean tugas) dan <strong>HeLa Genome</strong> (grafik memori persisten). Delapan sel lainnya menyediakan kapabilitas berkas, eksekusi perintah, proses, riset, browser dan persepsi gambar, desain antarmuka, mobile, dan 3D.",
    "index.install_title": "Instalasi",
    "index.verify_title": "Verifikasi",
    "index.verify_desc": "Tiga gerbang verifikasi, semuanya diharapkan berstatus hijau sebelum digunakan:",
    "profiles.title": "Profil & Konfigurasi",
    "profiles.lead": "Delapan profil instalasi. Lihat pratinjau konfigurasi klien di bawah; gunakan CLI untuk membuat konfigurasi terpasang. Matriks CLI menguji 80 kombinasi profil/backend.",
    "profiles.matrix_title": "Matriks Profil",
    "profiles.configurator_title": "Meja Kerja Konfigurasi",
    "profiles.label_profile": "Profil target",
    "profiles.label_client": "Klien agen",
    "arch.title": "Arsitektur",
    "arch.lead": "Dua backbone mengoordinasikan sepuluh sel melalui standar MCP stdio (JSON-RPC 2.0). Mitosis merutekan dan merencanakan; Genome mengingat. Setiap sel lainnya berfokus pada fungsi tunggal.",
    "arch.backbones_title": "Dual Backbone",
    "arch.servers_title": "Referensi Server",
    "arch.transport_title": "Transport Komunikasi",
    "arch.keys_title": "Kunci API & Akses",
    "workflows.title": "Alur Kerja",
    "workflows.lead": "Enam resep alur kerja lintas-sel yang memadukan perencanaan Mitosis, memori Genome, dan alat khusus. Hardware serta provider yang dibutuhkan harus diverifikasi terpisah.",
    "diag.title": "Diagnostik",
    "diag.lead": "Cara memeriksa, menganalisis, dan memperbaiki sel apa pun dalam ekosistem. Mulai dari laporan satu perintah (doctor) hingga penanganan mode kegagalan yang umum.",
    "showcase.title": "Pameran & Bukti",
    "showcase.lead": "Rekaman gerbang verifikasi dan deployment produksi yang dibangun langsung oleh ekosistem. Bukti nyata bahwa sel-sel bekerja selaras sebagaimana dirancang.",
    "privacy.title": "Kebijakan Privasi",
    "privacy.lead": "Berlaku sejak 2026-09-21. Ringkasnya: situs ini tidak mengumpulkan data apa pun. Perangkat lunak berjalan di komputer Anda sendiri. Kami tidak menginginkan data Anda.",
    "terms.title": "Ketentuan Penggunaan",
    "terms.lead": "Berlaku sejak 2026-09-21. Ringkasnya: ini adalah perangkat lunak open source berlisensi MIT yang disediakan apa adanya. Anda menjalankannya; Anda bertanggung jawab penuh atas apa yang dilakukannya."
  }
};

function getActiveLanguage() {
  return localStorage.getItem("hela_lang") || "en";
}

function setLanguage(lang) {
  if (!I18N[lang]) lang = "en";
  localStorage.setItem("hela_lang", lang);
  document.documentElement.lang = lang;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (I18N[lang] && I18N[lang][key]) {
      el.innerHTML = I18N[lang][key];
    }
  });

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    if (btn.getAttribute("data-lang") === lang) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const isId = document.documentElement.lang === "id" || window.location.pathname.includes("/id/");
  const currentLang = isId ? "id" : "en";
  localStorage.setItem("hela_lang", currentLang);

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    const btnLang = btn.getAttribute("data-lang");
    if (btnLang === currentLang) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }

    btn.addEventListener("click", (e) => {
      const targetLang = btn.getAttribute("data-lang");
      if (targetLang) {
        localStorage.setItem("hela_lang", targetLang);
      }
      const href = btn.getAttribute("href");
      if (href) {
        return; // Allow native navigation to the target language static page
      }
      e.preventDefault();
      const currentFile = window.location.pathname.split("/").pop() || "index.html";
      if (targetLang === "id" && !window.location.pathname.includes("/id/")) {
        window.location.href = "id/" + currentFile;
      } else if (targetLang === "en" && window.location.pathname.includes("/id/")) {
        window.location.href = "../" + currentFile;
      }
    });
  });

  // Configurator (profiles page only)
  const profileSelect = document.getElementById("profileSelect");
  const clientSelect = document.getElementById("clientSelect");
  const codeOutput = document.getElementById("configCode");
  const promptCodeOutput = document.getElementById("promptCode");
  function updateOutput() {
    if (!profileSelect || !clientSelect) return;
    if (codeOutput) codeOutput.textContent = renderConfig(profileSelect.value, clientSelect.value);
    if (promptCodeOutput) promptCodeOutput.textContent = renderAgentPrompt(profileSelect.value, clientSelect.value);
  }
  if (profileSelect && clientSelect) {
    profileSelect.addEventListener("change", updateOutput);
    clientSelect.addEventListener("change", updateOutput);
    updateOutput();
  }

  // Right-rail table of contents from section headings
  const tocList = document.getElementById("tocList");
  if (tocList) {
    const heads = document.querySelectorAll("main.doc-content h2[id]");
    tocList.replaceChildren(...Array.from(heads).map(heading => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = "#" + heading.id;
      link.textContent = heading.textContent;
      item.append(link);
      return item;
    }));
  }

  // Copy buttons (code dossiers + configurator)
  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const pane = btn.closest(".code-dossier");
      const target = pane ? pane.querySelector("pre code") : null;
      const text = target ? target.textContent : "";
      const feedback = (message) => {
        const orig = btn.textContent;
        btn.textContent = message;
        btn.setAttribute("aria-live", "polite");
        setTimeout(() => { btn.textContent = orig; }, 2000);
      };
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(text);
        feedback(isId ? "TERSALIN" : "COPIED");
      } catch {
        feedback(isId ? "SALIN MANUAL" : "COPY MANUALLY");
      }
    });
  });

  // Command palette
  const backdrop = document.getElementById("cmdPalette");
  const cmdInput = document.getElementById("cmdInput");
  const cmdResults = document.getElementById("cmdResults");
  function matches() {
    const q = (cmdInput && cmdInput.value || "").toLowerCase().trim();
    const out = [];
    const documents = typeof findLibraryDocuments === "function" ? findLibraryDocuments(q) : [];
    documents.filter(entry => q && entry.title.toLowerCase().includes(q)).forEach(entry => {
      out.push({ title: entry.title, tag: isId ? "dokumen" : "document", link: pagePrefix + entry.link });
    });
    PAGES.forEach(page => {
      if (!q || page.title.toLowerCase().includes(q)) out.push({ title: page.title, tag: "page", link: pagePrefix + page.link });
    });
    Object.keys(INVENTORY).forEach((k) => {
      const s = INVENTORY[k];
      s.tools.forEach((t) => {
        if (!q || t.toLowerCase().includes(q) || s.alias.toLowerCase().includes(q)) {
          out.push({ title: s.alias + " · " + t, tag: "tool", link: pagePrefix + "architecture.html#srv-" + k.replace("hela-", "") });
        }
      });
    });
    documents.filter(entry => !q || !entry.title.toLowerCase().includes(q)).forEach(entry => {
      out.push({ title: entry.title, tag: isId ? "dokumen" : "document", link: pagePrefix + entry.link });
    });
    return out.slice(0, 12);
  }
  function renderMatches() {
    if (!cmdResults) return;
    const results = matches();
    cmdResults.replaceChildren(...results.map(match => {
      const link = document.createElement("a");
      link.className = "cmd-item";
      link.href = match.link;
      const title = document.createElement("span");
      title.textContent = match.title;
      const tag = document.createElement("span");
      tag.className = "cmd-item-tag";
      tag.setAttribute("aria-hidden", "true");
      tag.textContent = match.tag;
      link.append(title, tag);
      return link;
    }));
    if (!results.length) {
      const empty = document.createElement("p");
      empty.className = "cmd-item";
      empty.textContent = isId ? "Tidak ada hasil yang cocok." : "No matching documentation or tools.";
      cmdResults.append(empty);
    }
  }
  let paletteOpener;
  function openPalette() {
    if (!backdrop) return;
    paletteOpener = document.activeElement;
    backdrop.setAttribute("aria-modal", "true");
    backdrop.style.display = "flex";
    if (cmdInput) { cmdInput.value = ""; renderMatches(); cmdInput.focus(); }
  }
  function closePalette() {
    if (!backdrop || backdrop.style.display !== "flex") return;
    if (backdrop) backdrop.style.display = "none";
    paletteOpener?.focus();
  }
  document.querySelectorAll(".cmd-close").forEach(button => button.addEventListener("click", closePalette));
  document.querySelectorAll(".open-cmd-palette").forEach((b) => b.addEventListener("click", openPalette));
  if (backdrop) backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closePalette(); });
  if (cmdInput) cmdInput.addEventListener("input", renderMatches);
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (backdrop && backdrop.style.display === "flex") closePalette();
      else openPalette();
    }
    if (e.key === "Escape") closePalette();
    if (!backdrop || backdrop.style.display !== "flex") return;
    const focusable = [...backdrop.querySelectorAll("input, a[href], button")];
    if (e.key === "Tab" && focusable.length) {
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    if (e.key === "ArrowDown" && document.activeElement === cmdInput) {
      const first = cmdResults?.querySelector("a");
      if (first) { e.preventDefault(); first.focus(); }
    }
    if (e.key === "Enter" && document.activeElement === cmdInput) cmdResults?.querySelector("a")?.click();
  });
});
