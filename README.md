![Banner](https://media.discordapp.net/attachments/1310947549510762577/1394395883881107547/grokness-banner.png?ex=6878a21d&is=6877509d&hm=5a28008bc2fc589019d84ce8864e2ca667f5b8856df4dc5535eb1b6f2f3e89d5&=&width=1525&height=858)

# Grokness

[![License](https://img.shields.io/github/license/imjustprism/grokness?style=for-the-badge)](LICENSE) [![Version](https://img.shields.io/github/package-json/v/imjustprism/grokness?style=for-the-badge)](https://github.com/imjustprism/grokness/blob/main/package.json) [![Maintenance](https://img.shields.io/maintenance/yes/2025?style=for-the-badge)]()

**Grokness** is a minimalist browser extension for [grok.com](https://grok.com), inspired by Vencord. It adds a powerful **Grokness** section to your settings, letting you seamlessly enable, disable, and manage custom plugins to supercharge your Grok experience.
> ⚠️ **Note**: This project is in active development. Some features are still hard‑coded and may change.
> 📜 **Also available as a standalone userscript!** Install via Violentmonkey, Tampermonkey, or any userscript manager from [Greasy Fork](https://greasyfork.org/en/scripts/542735-grokness).

## Quick Install
1. Go to [Grokness on Greasy Fork](https://greasyfork.org/en/scripts/542735-grokness)
2. Click **Install** in your userscript manager (Violentmonkey, Tampermonkey, etc.)
3. Reload [grok.com](https://grok.com) and open **Settings → Grokness** to manage plugins.

## 🔧 Features
- **Plugin Management**: Enable, disable, and reorder your plugins with a single click
- **Custom Plugins**: Drop your own scripts into `src/plugins/` and manage them from the UI
- **Lightweight & Fast**: Minimal overhead to keep your browsing swift
- **Cross‑Browser**: Builds available for Chrome, Firefox, and any Chromium‑based browser

## Quick Start

### Prerequisites
- **Git**
- **Bun** (or **Node.js** if you prefer)

### 1. Clone & Install
    git clone https://github.com/imjustprism/grokness.git
    cd grokness
    bun install

### 2. Build
    bun run build:chrome   # Chrome, Edge, Brave, etc.
    bun run build:firefox  # Firefox
    bun run build          # Both

### 3. Load in Your Browser

**Chromium (Chrome/Edge/Brave)**
1. Go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select `dist/chrome`

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add‑on…**
3. Select `dist/firefox/manifest.json`

## Usage
1. Open [grok.com](https://grok.com)
2. Click **Settings → Grokness**
3. Toggle plugins on/off as needed

## 🛠 Development
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

## Contributing
We ❤️ community contributions!
- Read our [Contributing Guide](CONTRIBUTING.md)
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md)
- Open issues or pull requests!

## License
Distributed under the [GNU GPL v3 License](LICENSE).

## FAQ
**Q: What is Grokness?**
A: A browser extension that adds a plugin system to grok.com.

**Q: Is it safe?**
A: Absolutely. Grokness is 100% open source.

**Q: How do I create my own plugin?**
A: See `src/plugins/` for templates and examples.

🌟 If you find Grokness useful, please **star** the repo and share it with your friends!
