# Grokness

**Grokness** is a minimalist browser extension for [grok.com](https://grok.com), inspired by Vencord. It adds a powerful **Plugins** section to your settings, letting you easily enable, disable, and manage custom plugins to supercharge your Grok experience.

⚠️ **Note**: This project is still in development. There are some issues and some parts are hardcoded, making it not very easy to manage yet.

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/imjustprism/grok.git
cd grokness
bun install
```

### 2. Build the Extension

Choose the build for your browser:

```bash
bun run build:chrome   # For Chrome, Edge, Brave, etc.
bun run build:firefox  # For Firefox
bun run build          # For Both
```

### 3. Load the Extension

**For Chromium Browsers:**
    Go to `chrome://extensions/`
    Enable **Developer mode**
    Click **Load unpacked** and select the `dist/chrome` folder

**For Firefox:**
    Go to `about:debugging#/runtime/this-firefox`
    Click **Load Temporary Add-on…** and select `dist/firefox/manifest.json`

---

## 🧩 Using Plugins

1. Visit [grok.com](https://grok.com)
2. Open **Settings** and navigate to the **Grokness** tab
3. Toggle your custom plugins on or off as you wish

---

## 🤝 Contributing

We love community contributions! To get started:

- Read our [Contributing Guide](CONTRIBUTING.md)
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md)
- Fork the repo, create a feature branch, and submit a pull request

All ideas, bug fixes, and improvements are welcome!

---

## 📄 License

Grokness is licensed under the [GNU GPL v3 License](LICENSE).

---

## 🙋 FAQ

**Q: What is Grokness?**
A: A browser extension that lets you manage and run custom plugins on grok.com.

**Q: Is it safe?**
A: Grokness is open source—review the code, suggest improvements, and help keep it secure!

**Q: How do I make my own plugin?**
A: Check the `src/plugins/` directory for examples and start building your own!

---

## 🌟 Star This Project!

If you find Grokness useful, please consider starring the repo and sharing it with others!
