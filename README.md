# MetaMind: AI-Powered File Intelligence System

MetaMind is a cross-platform desktop application that leverages AI to automatically analyze, tag, and organize files with natural language search capabilities. Built with Tauri, React, TypeScript, and Rust.

## Features

- 🔍 **Semantic Search**: Find files using natural language with AI-powered vector similarity
- 🤖 **AI Analysis**: Automatic file categorization and comprehensive content analysis  
- 📊 **Smart Collections**: Organize files into intelligent collections with proper data persistence
- 🧠 **Vector Intelligence**: Semantic understanding of file content and folder themes
- 🎨 **Beautiful UI**: Apple + Notion inspired design system with responsive interactions
- 🔒 **Privacy First**: Local processing with optional cloud features
- ⚡ **High Performance**: Rust backend with React frontend and vector caching
- 🌓 **Dark Mode**: Automatic theme switching

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Zustand** for state management
- **Lucide React** for icons

### Backend
- **Rust** with Tauri framework
- **SQLite** with FTS5 for full-text search and vector storage
- **Tantivy** for advanced search indexing
- **Vector Search** with cosine similarity and caching
- **Ollama** for local AI processing and embedding generation

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Rust](https://rustup.rs/) (latest stable)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)

### Install Tauri CLI

```bash
cargo install tauri-cli
```

### Platform-specific Requirements

#### macOS
```bash
xcode-select --install
```

#### Windows
- Install [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev build-essential curl wget libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

## Quick Setup

### Automatic Installation (Recommended)

**For macOS/Linux:**
```bash
git clone https://github.com/mrvarrier/metamind.git
cd metamind
chmod +x setup.sh
./setup.sh
```

**For Windows:**
```cmd
git clone https://github.com/mrvarrier/metamind.git
cd metamind
setup.bat
```

The setup scripts will automatically:
- Install Node.js, Rust, and Tauri CLI
- Install platform-specific dependencies
- Install and configure Ollama
- Download required AI models
- Set up the development environment

### Manual Installation

If you prefer to install manually or the setup script fails:

1. **Clone the repository**
   ```bash
   git clone https://github.com/mrvarrier/metamind.git
   cd metamind
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Ollama (for AI features)**
   ```bash
   # macOS
   brew install ollama
   
   # Linux
   curl -fsSL https://ollama.ai/install.sh | sh
   
   # Windows - Download from https://ollama.ai/download
   ```

4. **Pull AI models**
   ```bash
   ollama pull llama3.1:8b
   ollama pull nomic-embed-text
   ```

## Development

### Start the development server

```bash
npm run tauri dev
```

This will:
- Start the Vite development server for the frontend
- Compile the Rust backend
- Launch the Tauri application

### Build for production

```bash
npm run tauri build
```

## Project Structure

```
metamind/
├── src-tauri/           # Rust backend
│   ├── src/
│   │   ├── main.rs      # Application entry point
│   │   ├── vector_math.rs        # Vector similarity calculations
│   │   ├── vector_storage.rs     # Vector database operations
│   │   ├── semantic_search.rs    # Semantic search engine
│   │   ├── folder_vectorizer.rs  # Folder aggregation
│   │   ├── vector_cache.rs       # High-performance caching
│   │   ├── vector_benchmarks.rs  # Performance testing
│   │   ├── file_monitor/         # File monitoring and processing
│   │   ├── ai_processor/         # AI model integration
│   │   ├── processing_queue/     # Background job processing
│   │   └── database/            # SQLite database layer
│   ├── Cargo.toml       # Rust dependencies
│   └── tauri.conf.json  # Tauri configuration
├── src/                 # React frontend
│   ├── components/      # React components
│   │   ├── search/      # Search interface with semantic modes
│   │   ├── collections/ # Collection management (fixed delete)
│   │   └── common/      # Reusable UI components
│   ├── stores/          # Zustand state management
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   └── styles/          # CSS and styling
├── docs/                # Technical documentation
│   ├── README.md
│   ├── VECTOR_SEARCH_GUIDE.md
│   └── TECHNICAL_ARCHITECTURE.md
└── package.json         # Node.js dependencies
```

## Configuration

### AI Models

MetaMind supports multiple AI providers:

- **Ollama** (default): Local AI processing
- **OpenAI**: Cloud-based AI (API key required)
- **Anthropic**: Cloud-based AI (API key required)

Configure your preferred AI provider in the application settings after onboarding.

### Performance Settings

Adjust performance settings based on your system:

- **Power Saver**: Minimal resource usage
- **Balanced**: Good balance of speed and efficiency  
- **Performance**: Maximum speed and responsiveness

## Usage

### First Run

1. **System Analysis**: MetaMind will analyze your system capabilities
2. **Model Selection**: Choose your preferred AI model
3. **Folder Selection**: Select folders to monitor and analyze
4. **Performance Setup**: Configure resource usage settings

### Searching

Use natural language queries with semantic understanding:

- "photos from last week" - finds images by date and content
- "PDF documents about project" - semantic content matching
- "code files modified today" - temporal and type filtering
- "presentations larger than 10MB" - size and semantic filtering
- "files similar to machine learning" - concept-based discovery

### Collections

Organize files into smart collections with persistent storage:
- Manual collections: Drag and drop files with backend sync
- Automatic collections: Rule-based organization
- AI collections: Semantic grouping with vector similarity
- Reliable deletion: Collections properly removed from both UI and database

## Troubleshooting

### Common Issues

1. **Tauri build fails**
   - Ensure all prerequisites are installed
   - Update Rust: `rustup update`
   - Clear cache: `cargo clean`

2. **AI models not working**
   - Check if Ollama is running: `ollama serve`
   - Verify models are installed: `ollama list`
   - Check network connectivity for cloud providers

3. **File monitoring not working**
   - Check folder permissions
   - Verify folders exist and are accessible
   - Review excluded patterns in settings

### Performance Optimization

- Reduce monitored folders for faster processing
- Adjust CPU/memory limits in performance settings
- Enable GPU acceleration if available
- Use SSDs for better file I/O performance

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Commit your changes: `git commit -am 'Add feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

### Development Guidelines

- Follow Rust and TypeScript best practices
- Add tests for new features
- Update documentation as needed
- Use conventional commit messages

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Tauri](https://tauri.app/) for the amazing cross-platform framework
- [Ollama](https://ollama.ai/) for local AI model serving
- [Tantivy](https://github.com/quickwit-oss/tantivy) for search indexing
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework

## Roadmap

- [ ] Browser extension integration
- [ ] Cloud sync capabilities  
- [ ] Plugin architecture
- [ ] Mobile companion app
- [ ] Advanced AI features (summarization, Q&A)
- [ ] Team collaboration features

## Support

If you encounter any issues or have questions:

1. Check the [troubleshooting guide](#troubleshooting)
2. Search [existing issues](https://github.com/mrvarrier/metamind/issues)
3. Create a [new issue](https://github.com/mrvarrier/metamind/issues/new) with details

For feature requests and discussions, please use [GitHub Discussions](https://github.com/mrvarrier/metamind/discussions).