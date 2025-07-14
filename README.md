![Banner](https://media.discordapp.net/attachments/1392621222944047267/1394396712034107574/grokness-banner.png?ex=6876a8a2&is=68755722&hm=00170fd731f419127ce036ae85f7cf392330589a2862fd2898593f0b8c8bc3ec&=&width=1525&height=858)

# Grokness

[![License](https://img.shields.io/github/license/imjustprism/grokness?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/github/package-json/v/imjustprism/grokness?style=for-the-badge)](https://github.com/imjustprism/grokness/blob/main/package.json)
[![Maintenance](https://img.shields.io/maintenance/yes/2025?style=for-the-badge)]()

**Grokness** is a minimalist browser extension for [grok.com](https://grok.com), inspired by Vencord. It adds a powerful **Plugins** section to your settings, letting you seamlessly enable, disable, and manage custom plugins to supercharge your Grok experience.

> ⚠️ **Note**: This project is in active development. Some features are still hard‑coded and may change.

---

## 🔧 Features

- **Plugin Management**
  Enable, disable, and reorder your plugins with a single click.
- **Custom Plugins**
  Drop your own scripts into `src/plugins/` and manage them from the UI.
- **Lightweight & Fast**
  Minimal overhead to keep your browsing swift.
- **Cross‑Browser**
  Builds available for Chrome, Firefox (and any Chromium‑based browser).

---

## 🚀 Quick Start

### Prerequisites

- **Git**
- **Bun** (or **Node.js** if you prefer)

### 1. Clone & Install

```bash
git clone https://github.com/imjustprism/grokness.git
cd grokness
bun install
```

### 2. Build

Choose your target:

```bash
bun run build:chrome   # Chrome, Edge, Brave, etc.
bun run build:firefox  # Firefox
bun run build          # Both
```

### 3. Load in Your Browser

<details>
<summary><strong>Chromium (Chrome/Edge/Brave)</strong></summary>

1. Go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select `dist/chrome`
</details>

<details>
<summary><strong>Firefox</strong></summary>

1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `dist/firefox/manifest.json`
</details>

---

## 🧩 Usage

1. Open [grok.com](https://grok.com)
2. Click **Settings** → **Grokness**
3. Toggle plugins on/off as needed

---

## 🛠 Development

```bash
# Fork & clone
git clone https://github.com/your-username/grokness.git
cd grokness

# Create your feature branch
git checkout -b feature/awesome-feature

# After coding...
git add .
git commit -m "feat: add awesome feature"
git push origin feature/awesome-feature

# Open a PR against imjustprism/grokness
```

---

## 🤝 Contributing

We ❤️ community contributions! Please:

- Read our [Contributing Guide](CONTRIBUTING.md)
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md)
- Open issues or pull requests!

---

## 📄 License

Distributed under the [GNU GPL v3 License](LICENSE).

---

## ❓ FAQ

**Q: What is Grokness?**
A: A browser extension that adds a plugin system to grok.com.

**Q: Is it safe?**
A: Absolutely. Grokness is 100% open source.

**Q: How do I create my own plugin?**
A: See `src/plugins/` for templates and examples.

---

🌟 If you find Grokness useful, please **star** the repo and share it with your friends!
