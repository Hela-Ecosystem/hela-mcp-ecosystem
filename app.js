/**
 * HeLa MCP Ecosystem — Documentation Engine
 * Canonical data: config/inventory.json (mirrored here for static hosting).
 * Covers: client configurator, command palette, copy buttons.
 */

// hela:inventory:start
const { inventory: INVENTORY, profiles: PROFILES } = globalThis.HELA_DOCS_DATA;
// hela:inventory:end

function renderConfig(profileKey, clientKey) {
  const prof = PROFILES[profileKey] || PROFILES["dev-workspace"];
  const root = "/absolute/path/to/MCPservers";
  const servers = prof.servers.map((k) => ({ id: k, dir: INVENTORY[k].dir, entry: INVENTORY[k].entry }));

  if (["cursor", "claude", "gemini", "antigravity"].includes(clientKey)) {
    const mcpServers = {};
    for (const s of servers) mcpServers[s.id] = { command: "node", args: [root + "/" + s.dir + "/" + s.entry] };
    return JSON.stringify({ mcpServers }, null, 2);
  }
  if (clientKey === "opencode" || clientKey === "kilo") {
    const mcp = {};
    for (const s of servers) mcp[s.id] = { type: "local", enabled: true, command: ["node", root + "/" + s.dir + "/" + s.entry] };
    return JSON.stringify({ mcp }, null, 2);
  }
  if (clientKey === "zed") {
    const context_servers = {};
    for (const s of servers) context_servers[s.id] = { command: "node", args: [root + "/" + s.dir + "/" + s.entry] };
    return JSON.stringify({ context_servers }, null, 2);
  }
  if (clientKey === "codex") {
    const lines = ["# Generated Codex / ChatGPT MCP Server Configuration"];
    for (const s of servers) lines.push("\n[mcp_servers." + s.id + ']\ncommand = "node"\nargs = [' + JSON.stringify(root + "/" + s.dir + "/" + s.entry) + ']');
    return lines.join("\n");
  }
  if (clientKey === "docker") {
    const services = {};
    const volumes = { workspace: {} };
    servers.forEach((s) => {
      const data = s.id + "-data";
      volumes[data] = {};
      services[s.id] = { image: "hela-ecosystem:" + profileKey + "-" + globalThis.HELA_DOCS_DATA.release.ecosystem,
        init: true, stdin_open: true, tty: false, working_dir: "/workspace",
        command: ["node", "/opt/hela/" + s.dir + "/" + s.entry],
        environment: { HELA_PROFILE: profileKey, HELA_ECOSYSTEM_ROOT: "/opt/hela/hela-mcp-ecosystem" },
        volumes: [data + ":/data", "workspace:/workspace"] };
    });
    return JSON.stringify({ services, volumes }, null, 2);
  }
  return "// Select a profile and client.";
}

const isIdPage = (typeof document !== "undefined" && (document.documentElement.lang === "id" || window.location.pathname.includes("/id/")));

const PAGES = isIdPage ? [
  { title: "01 Ikhtisar", link: "index.html" },
  { title: "04 Arsitektur", link: "architecture.html" },
  { title: "05 Alur Kerja", link: "workflows.html" },
  { title: "06 Profil & Konfigurasi", link: "profiles.html" },
  { title: "07 Pameran & Demo", link: "showcase.html" },
  { title: "08 Diagnostik", link: "troubleshooting.html" },
  { title: "09 Privasi", link: "privacy.html" },
  { title: "10 Ketentuan", link: "terms.html" }
] : [
  { title: "01 Overview", link: "index.html" },
  { title: "04 Architecture", link: "architecture.html" },
  { title: "05 Workflows", link: "workflows.html" },
  { title: "06 Profiles and Config", link: "profiles.html" },
  { title: "07 Showcase", link: "showcase.html" },
  { title: "08 Diagnostics", link: "troubleshooting.html" },
  { title: "09 Privacy", link: "privacy.html" },
  { title: "10 Terms", link: "terms.html" }
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
    "index.what_desc": "Ten specialized servers, each a biological cell with one job. Two backbones coordinate them: <strong>HeLa Mitosis</strong> (task reasoning and routing) and <strong>HeLa Genome</strong> (persistent memory graph). The remaining eight cells provide filesystem, execution, processes, research, browser, design, mobile, and 3D capabilities.",
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
    "index.what_desc": "Sepuluh server terspesialisasi, masing-masing bertindak layaknya sel biologis dengan satu tugas utama. Dua backbone mengoordinasikannya: <strong>HeLa Mitosis</strong> (penalaran & perutean tugas) dan <strong>HeLa Genome</strong> (grafik memori persisten). Delapan sel lainnya menyediakan kapabilitas berkas, eksekusi perintah, proses, riset, browser, desain antarmuka, mobile, dan 3D.",
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
  function updateOutput() {
    if (!profileSelect || !clientSelect || !codeOutput) return;
    codeOutput.textContent = renderConfig(profileSelect.value, clientSelect.value);
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
    tocList.innerHTML = Array.from(heads).map((h) =>
      '<li><a href="#' + h.id + '">' + h.textContent + "</a></li>"
    ).join("");
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
    Object.keys(INVENTORY).forEach((k) => {
      const s = INVENTORY[k];
      s.tools.forEach((t) => {
        if (!q || t.toLowerCase().includes(q) || s.alias.toLowerCase().includes(q)) {
          out.push({ title: s.alias + " · " + t, tag: "tool", link: "architecture.html#srv-" + k.replace("hela-", "") });
        }
      });
    });
    PAGES.forEach((p) => {
      if (!q || p.title.toLowerCase().includes(q)) out.push({ title: p.title, tag: "page", link: p.link });
    });
    return out.slice(0, 12);
  }
  function renderMatches() {
    if (!cmdResults) return;
    cmdResults.innerHTML = matches().map((m) =>
      '<div class="cmd-item" data-link="' + m.link + '"><span>' + m.title + '</span><span class="cmd-item-tag">' + m.tag + "</span></div>"
    ).join("");
    cmdResults.querySelectorAll(".cmd-item").forEach((el) => {
      el.addEventListener("click", () => { window.location.href = el.getAttribute("data-link"); });
    });
  }
  function openPalette() {
    if (!backdrop) return;
    backdrop.style.display = "flex";
    if (cmdInput) { cmdInput.value = ""; renderMatches(); cmdInput.focus(); }
  }
  function closePalette() {
    if (backdrop) backdrop.style.display = "none";
  }
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
  });
});
