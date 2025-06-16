@echo off
REM MetaMind Setup Script for Windows
REM This script installs all required dependencies and sets up the development environment

setlocal enabledelayedexpansion

REM Colors (using echo with special characters)
set "RED=[91m"
set "GREEN=[92m" 
set "YELLOW=[93m"
set "BLUE=[94m"
set "NC=[0m"

echo ==================================================
echo           MetaMind Setup Script (Windows)
echo ==================================================
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo %RED%[ERROR]%NC% package.json not found.
    echo %RED%[ERROR]%NC% Please run this script from the MetaMind root directory.
    pause
    exit /b 1
)

if not exist "src-tauri\Cargo.toml" (
    echo %RED%[ERROR]%NC% src-tauri\Cargo.toml not found.
    echo %RED%[ERROR]%NC% Please run this script from the MetaMind root directory.
    pause
    exit /b 1
)

echo %BLUE%[INFO]%NC% Starting MetaMind setup for Windows...
echo.

REM Check for Node.js
echo %BLUE%[INFO]%NC% Checking for Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo %RED%[ERROR]%NC% Node.js not found.
    echo %YELLOW%[INFO]%NC% Please install Node.js 18+ from: https://nodejs.org
    echo %YELLOW%[INFO]%NC% Then run this script again.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo %GREEN%[SUCCESS]%NC% Node.js !NODE_VERSION! found
)

REM Check for npm
echo %BLUE%[INFO]%NC% Checking for npm...
npm --version >nul 2>&1
if errorlevel 1 (
    echo %RED%[ERROR]%NC% npm not found.
    echo %YELLOW%[INFO]%NC% npm should be installed with Node.js
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo %GREEN%[SUCCESS]%NC% npm !NPM_VERSION! found
)

REM Check for Rust
echo %BLUE%[INFO]%NC% Checking for Rust...
rustc --version >nul 2>&1
if errorlevel 1 (
    echo %YELLOW%[WARNING]%NC% Rust not found. Installing Rust...
    echo %BLUE%[INFO]%NC% Downloading Rust installer...
    
    REM Download and run rustup installer
    curl -O https://win.rustup.rs/x86_64
    if errorlevel 1 (
        echo %RED%[ERROR]%NC% Failed to download Rust installer.
        echo %YELLOW%[INFO]%NC% Please install Rust manually from: https://rustup.rs
        pause
        exit /b 1
    )
    
    echo %BLUE%[INFO]%NC% Running Rust installer...
    rustup-init.exe -y
    del rustup-init.exe
    
    REM Add Cargo to PATH for current session
    set "PATH=%PATH%;%USERPROFILE%\.cargo\bin"
    
    echo %GREEN%[SUCCESS]%NC% Rust installed successfully
) else (
    for /f "tokens=*" %%i in ('rustc --version') do set RUST_VERSION=%%i
    echo %GREEN%[SUCCESS]%NC% Rust !RUST_VERSION! found
)

REM Check for Cargo
echo %BLUE%[INFO]%NC% Checking for Cargo...
cargo --version >nul 2>&1
if errorlevel 1 (
    echo %RED%[ERROR]%NC% Cargo not found. Please restart your command prompt and try again.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('cargo --version') do set CARGO_VERSION=%%i
    echo %GREEN%[SUCCESS]%NC% Cargo !CARGO_VERSION! found
)

REM Install Tauri CLI
echo %BLUE%[INFO]%NC% Installing Tauri CLI...
cargo install tauri-cli
if errorlevel 1 (
    echo %RED%[ERROR]%NC% Failed to install Tauri CLI
    pause
    exit /b 1
) else (
    echo %GREEN%[SUCCESS]%NC% Tauri CLI installed successfully
)

REM Check for WebView2
echo %BLUE%[INFO]%NC% Checking for WebView2...
reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" >nul 2>&1
if errorlevel 1 (
    echo %YELLOW%[WARNING]%NC% WebView2 not found or needs update.
    echo %BLUE%[INFO]%NC% Please install WebView2 from: https://developer.microsoft.com/en-us/microsoft-edge/webview2/
    echo %BLUE%[INFO]%NC% This is required for Tauri applications on Windows.
) else (
    echo %GREEN%[SUCCESS]%NC% WebView2 found
)

REM Install project dependencies
echo %BLUE%[INFO]%NC% Installing project dependencies...
npm install
if errorlevel 1 (
    echo %RED%[ERROR]%NC% Failed to install project dependencies
    pause
    exit /b 1
) else (
    echo %GREEN%[SUCCESS]%NC% Project dependencies installed successfully
)

REM Check for Ollama
echo %BLUE%[INFO]%NC% Checking for Ollama...
ollama --version >nul 2>&1
if errorlevel 1 (
    echo %YELLOW%[WARNING]%NC% Ollama not found.
    echo %BLUE%[INFO]%NC% Please download and install Ollama from: https://ollama.ai/download
    echo %BLUE%[INFO]%NC% After installation, run the following commands:
    echo %BLUE%[INFO]%NC%   ollama pull llama3.1:8b
    echo %BLUE%[INFO]%NC%   ollama pull nomic-embed-text
) else (
    for /f "tokens=*" %%i in ('ollama --version') do set OLLAMA_VERSION=%%i
    echo %GREEN%[SUCCESS]%NC% Ollama !OLLAMA_VERSION! found
    
    REM Download models
    echo %BLUE%[INFO]%NC% Downloading AI models (this may take a while)...
    ollama pull llama3.1:8b
    ollama pull nomic-embed-text
    echo %GREEN%[SUCCESS]%NC% AI models downloaded successfully
)

REM Create .env file
echo %BLUE%[INFO]%NC% Creating environment configuration...
if not exist ".env" (
    echo # MetaMind Environment Variables > .env
    echo VITE_APP_NAME=MetaMind >> .env
    echo VITE_APP_VERSION=0.1.0 >> .env
    echo OLLAMA_HOST=http://localhost:11434 >> .env
    echo %GREEN%[SUCCESS]%NC% .env file created
) else (
    echo %GREEN%[SUCCESS]%NC% .env file already exists
)

REM Create logs directory
if not exist "logs" mkdir logs

echo.
echo ==================================================
echo           Setup Complete!
echo ==================================================
echo.
echo %GREEN%[SUCCESS]%NC% MetaMind is ready for development!
echo.
echo %BLUE%[INFO]%NC% Next steps:
echo   1. Start development server: npm run tauri dev
echo   2. Build for production: npm run tauri build
echo   3. View README.md for more information
echo.
echo %BLUE%[INFO]%NC% If you encounter any issues:
echo   - Restart your command prompt to refresh PATH
echo   - Ensure WebView2 is installed
echo   - Check that Ollama is running: ollama serve
echo   - Verify models are downloaded: ollama list
echo.

pause