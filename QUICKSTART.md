# MetaMind Quick Start Guide

Get MetaMind up and running in just a few minutes!

## 🚀 One-Command Setup

### macOS/Linux
```bash
git clone https://github.com/your-username/metamind.git && cd metamind && chmod +x setup.sh && ./setup.sh
```

### Windows (PowerShell/CMD)
```cmd
git clone https://github.com/your-username/metamind.git && cd metamind && setup.bat
```

## ⚡ Start Development

After setup completes:

```bash
npm run tauri dev
```

## 🎯 What You'll See

1. **System Analysis**: MetaMind analyzes your system capabilities
2. **Model Selection**: Choose your AI model (Llama 3.1 8B recommended)
3. **Folder Selection**: Pick folders to monitor (Documents, Desktop, etc.)
4. **Performance Setup**: Configure resource usage
5. **Ready to Use**: Start searching with natural language!

## 🔍 Try These Searches

- "photos from last week"
- "PDF documents about project"
- "code files modified today"
- "presentations larger than 10MB"

## 🛠️ Troubleshooting

### Setup Issues
```bash
# If setup fails, try manual steps:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh  # Install Rust
npm install -g @tauri-apps/cli                                   # Install Tauri CLI
npm install                                                      # Install dependencies
```

### AI Model Issues
```bash
# Start Ollama and download models:
ollama serve
ollama pull llama3.1:8b
ollama pull nomic-embed-text
```

### Build Issues
```bash
# Clean and rebuild:
cargo clean
npm run tauri build
```

## 📱 Platform Notes

### macOS
- Requires Xcode Command Line Tools
- Homebrew recommended for dependencies
- Apple Silicon and Intel both supported

### Windows
- Requires WebView2 (usually pre-installed on Windows 11)
- Visual Studio Build Tools needed
- Windows 10/11 supported

### Linux
- Works on Ubuntu, Debian, Arch, CentOS
- Requires webkit2gtk and build tools
- AppImage and deb packages available

## 🎨 Features Overview

- **Smart Search**: Natural language file search
- **AI Analysis**: Automatic content categorization
- **Real-time Monitoring**: Watch folders for changes
- **Beautiful UI**: Apple + Notion inspired design
- **Privacy First**: Local processing by default
- **Cross-platform**: Windows, macOS, Linux

## 📚 Next Steps

1. Explore the **Collections** feature for organizing files
2. Check out **Settings** for performance tuning
3. Try **Advanced Search** with filters
4. Set up additional folders to monitor

## 🆘 Need Help?

- 📖 [Full Documentation](README.md)
- 🐛 [Report Issues](https://github.com/your-username/metamind/issues)
- 💬 [Discussions](https://github.com/your-username/metamind/discussions)
- 📧 Email: support@metamind.app

---

**Happy file hunting with MetaMind! 🧠✨**