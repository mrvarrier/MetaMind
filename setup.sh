#!/bin/bash

# MetaMind Setup Script
# This script installs all required dependencies and sets up the development environment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Detect operating system
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command_exists apt-get; then
            OS="ubuntu"
        elif command_exists yum; then
            OS="centos"
        elif command_exists pacman; then
            OS="arch"
        else
            OS="linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        OS="windows"
    else
        OS="unknown"
    fi
}

# Install Node.js
install_nodejs() {
    log_info "Installing Node.js..."
    
    if command_exists node; then
        NODE_VERSION=$(node --version | cut -d 'v' -f 2)
        REQUIRED_VERSION="18.0.0"
        
        if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
            log_success "Node.js $NODE_VERSION is already installed and meets requirements"
            return
        else
            log_warning "Node.js $NODE_VERSION is installed but version 18+ is required"
        fi
    fi

    case $OS in
        "macos")
            if command_exists brew; then
                brew install node
            else
                log_error "Homebrew not found. Please install Homebrew first: https://brew.sh"
                exit 1
            fi
            ;;
        "ubuntu")
            curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        "centos")
            curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
            sudo yum install -y nodejs npm
            ;;
        "arch")
            sudo pacman -S nodejs npm
            ;;
        *)
            log_error "Please install Node.js 18+ manually: https://nodejs.org"
            exit 1
            ;;
    esac
    
    log_success "Node.js installed successfully"
}

# Install Rust
install_rust() {
    log_info "Installing Rust..."
    
    if command_exists rustc; then
        RUST_VERSION=$(rustc --version | cut -d ' ' -f 2)
        log_success "Rust $RUST_VERSION is already installed"
        return
    fi

    log_info "Installing Rust via rustup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    
    # Source the cargo environment
    source "$HOME/.cargo/env"
    
    log_success "Rust installed successfully"
}

# Install platform-specific dependencies
install_platform_deps() {
    log_info "Installing platform-specific dependencies..."
    
    case $OS in
        "macos")
            log_info "Installing Xcode Command Line Tools..."
            if ! xcode-select -p &>/dev/null; then
                xcode-select --install
                log_info "Please complete the Xcode Command Line Tools installation and run this script again."
                read -p "Press enter when installation is complete..."
            fi
            
            if command_exists brew; then
                log_info "Installing additional dependencies via Homebrew..."
                brew install pkg-config
            else
                log_warning "Homebrew not found. Some features may not work properly."
                log_info "Install Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            fi
            ;;
        "ubuntu")
            log_info "Installing build dependencies..."
            sudo apt update
            sudo apt install -y \
                libwebkit2gtk-4.0-dev \
                build-essential \
                curl \
                wget \
                libssl-dev \
                libgtk-3-dev \
                libayatana-appindicator3-dev \
                librsvg2-dev \
                pkg-config
            ;;
        "centos")
            log_info "Installing build dependencies..."
            sudo yum groupinstall -y "Development Tools"
            sudo yum install -y \
                webkit2gtk4.0-devel \
                openssl-devel \
                curl \
                wget \
                libappindicator-gtk3 \
                librsvg2-devel
            ;;
        "arch")
            log_info "Installing build dependencies..."
            sudo pacman -S \
                webkit2gtk \
                base-devel \
                curl \
                wget \
                openssl \
                appmenu-gtk-module \
                gtk3 \
                libappindicator-gtk3 \
                librsvg
            ;;
        *)
            log_warning "Unknown OS. Please install platform-specific dependencies manually."
            ;;
    esac
    
    log_success "Platform dependencies installed"
}

# Install Tauri CLI
install_tauri_cli() {
    log_info "Installing Tauri CLI..."
    
    if command_exists cargo-tauri; then
        log_success "Tauri CLI is already installed"
        return
    fi

    # Ensure cargo is in PATH
    source "$HOME/.cargo/env" 2>/dev/null || true
    
    cargo install tauri-cli
    log_success "Tauri CLI installed successfully"
}

# Install Ollama
install_ollama() {
    log_info "Installing Ollama..."
    
    if command_exists ollama; then
        log_success "Ollama is already installed"
        return
    fi

    case $OS in
        "macos")
            if command_exists brew; then
                brew install ollama
            else
                log_info "Downloading and installing Ollama..."
                curl -fsSL https://ollama.ai/install.sh | sh
            fi
            ;;
        "linux"|"ubuntu"|"centos"|"arch")
            log_info "Downloading and installing Ollama..."
            curl -fsSL https://ollama.ai/install.sh | sh
            ;;
        "windows")
            log_info "Please download and install Ollama for Windows from: https://ollama.ai/download"
            log_warning "Windows installation requires manual download"
            return
            ;;
        *)
            log_error "Unsupported OS for automatic Ollama installation"
            log_info "Please install Ollama manually: https://ollama.ai"
            return
            ;;
    esac
    
    log_success "Ollama installed successfully"
}

# Start Ollama service
start_ollama() {
    log_info "Starting Ollama service..."
    
    if ! command_exists ollama; then
        log_warning "Ollama not found, skipping service start"
        return
    fi

    case $OS in
        "macos")
            # On macOS, Ollama runs as a service
            if ! pgrep -f "ollama" > /dev/null; then
                log_info "Starting Ollama service..."
                ollama serve &
                sleep 3
            fi
            ;;
        "linux"|"ubuntu"|"centos"|"arch")
            # Check if systemd service exists
            if systemctl list-unit-files | grep -q ollama; then
                sudo systemctl enable ollama
                sudo systemctl start ollama
            else
                # Start Ollama in background
                if ! pgrep -f "ollama" > /dev/null; then
                    log_info "Starting Ollama service..."
                    ollama serve &
                    sleep 3
                fi
            fi
            ;;
    esac
    
    log_success "Ollama service started"
}

# Download AI models
download_models() {
    log_info "Downloading AI models..."
    
    if ! command_exists ollama; then
        log_warning "Ollama not installed, skipping model download"
        return
    fi

    # Wait for Ollama to be ready
    log_info "Waiting for Ollama to be ready..."
    for i in {1..30}; do
        if ollama list >/dev/null 2>&1; then
            break
        fi
        sleep 1
    done

    if ! ollama list >/dev/null 2>&1; then
        log_error "Ollama service not responding. Please start Ollama manually and run: ollama pull llama3.1:8b"
        return
    fi

    log_info "Downloading Llama 3.1 8B model (this may take a while)..."
    ollama pull llama3.1:8b

    log_info "Downloading embedding model..."
    ollama pull nomic-embed-text

    log_success "AI models downloaded successfully"
}

# Install project dependencies
install_project_deps() {
    log_info "Installing project dependencies..."
    
    if [ ! -f "package.json" ]; then
        log_error "package.json not found. Are you in the correct directory?"
        exit 1
    fi

    # Install Node.js dependencies
    log_info "Installing Node.js dependencies..."
    npm install

    log_success "Project dependencies installed"
}

# Setup development environment
setup_dev_env() {
    log_info "Setting up development environment..."
    
    # Create .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        log_info "Creating .env file..."
        cat > .env << 'EOF'
# MetaMind Environment Variables
VITE_APP_NAME=MetaMind
VITE_APP_VERSION=0.1.0
OLLAMA_HOST=http://localhost:11434
EOF
        log_success ".env file created"
    fi

    # Create logs directory
    mkdir -p logs
    
    log_success "Development environment setup complete"
}

# Verify installation
verify_installation() {
    log_info "Verifying installation..."
    
    local errors=0
    
    # Check Node.js
    if command_exists node; then
        NODE_VERSION=$(node --version)
        log_success "Node.js: $NODE_VERSION"
    else
        log_error "Node.js not found"
        errors=$((errors + 1))
    fi
    
    # Check npm
    if command_exists npm; then
        NPM_VERSION=$(npm --version)
        log_success "npm: $NPM_VERSION"
    else
        log_error "npm not found"
        errors=$((errors + 1))
    fi
    
    # Check Rust
    if command_exists rustc; then
        RUST_VERSION=$(rustc --version)
        log_success "Rust: $RUST_VERSION"
    else
        log_error "Rust not found"
        errors=$((errors + 1))
    fi
    
    # Check Cargo
    if command_exists cargo; then
        CARGO_VERSION=$(cargo --version)
        log_success "Cargo: $CARGO_VERSION"
    else
        log_error "Cargo not found"
        errors=$((errors + 1))
    fi
    
    # Check Tauri CLI
    if command_exists cargo-tauri; then
        log_success "Tauri CLI: installed"
    else
        log_error "Tauri CLI not found"
        errors=$((errors + 1))
    fi
    
    # Check Ollama
    if command_exists ollama; then
        log_success "Ollama: installed"
        
        # Check if models are available
        if ollama list | grep -q "llama3.1:8b"; then
            log_success "Llama 3.1 8B model: available"
        else
            log_warning "Llama 3.1 8B model: not found"
        fi
        
        if ollama list | grep -q "nomic-embed-text"; then
            log_success "Embedding model: available"
        else
            log_warning "Embedding model: not found"
        fi
    else
        log_warning "Ollama not found (optional)"
    fi
    
    if [ $errors -eq 0 ]; then
        log_success "All required dependencies are installed!"
        return 0
    else
        log_error "$errors error(s) found. Please fix the issues above."
        return 1
    fi
}

# Main installation function
main() {
    echo "=================================================="
    echo "          MetaMind Setup Script"
    echo "=================================================="
    echo
    
    # Detect OS
    detect_os
    log_info "Detected OS: $OS"
    echo
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ] || [ ! -f "src-tauri/Cargo.toml" ]; then
        log_error "This doesn't appear to be the MetaMind project directory."
        log_error "Please run this script from the MetaMind root directory."
        exit 1
    fi
    
    # Installation steps
    install_nodejs
    echo
    
    install_rust
    echo
    
    install_platform_deps
    echo
    
    install_tauri_cli
    echo
    
    install_ollama
    echo
    
    start_ollama
    echo
    
    download_models
    echo
    
    install_project_deps
    echo
    
    setup_dev_env
    echo
    
    # Verify installation
    echo "=================================================="
    echo "          Verification"
    echo "=================================================="
    echo
    
    if verify_installation; then
        echo
        echo "=================================================="
        echo "          Setup Complete!"
        echo "=================================================="
        echo
        log_success "MetaMind is ready for development!"
        echo
        log_info "Next steps:"
        echo "  1. Start development server: npm run tauri dev"
        echo "  2. Build for production: npm run tauri build"
        echo "  3. View README.md for more information"
        echo
        log_info "If you encounter any issues:"
        echo "  - Check the troubleshooting section in README.md"
        echo "  - Ensure Ollama is running: ollama serve"
        echo "  - Verify models are downloaded: ollama list"
        echo
    else
        echo
        log_error "Setup completed with errors. Please fix the issues above before proceeding."
        exit 1
    fi
}

# Handle script interruption
trap 'log_error "Setup interrupted"; exit 1' INT TERM

# Check if running with bash
if [ -z "$BASH_VERSION" ]; then
    log_error "This script requires bash. Please run with: bash setup.sh"
    exit 1
fi

# Run main function
main "$@"