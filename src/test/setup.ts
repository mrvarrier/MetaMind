import '@testing-library/jest-dom'
import { vi } from 'vitest'
import React from 'react'

// Mock Tauri API
const mockTauriApi = {
  invoke: vi.fn(),
  listen: vi.fn(),
  emit: vi.fn(),
  dialog: {
    open: vi.fn(),
    save: vi.fn(),
    message: vi.fn(),
    ask: vi.fn(),
    confirm: vi.fn(),
  },
  fs: {
    readTextFile: vi.fn(),
    writeTextFile: vi.fn(),
    readBinaryFile: vi.fn(),
    writeBinaryFile: vi.fn(),
    readDir: vi.fn(),
    createDir: vi.fn(),
    removeDir: vi.fn(),
    removeFile: vi.fn(),
    renameFile: vi.fn(),
    copyFile: vi.fn(),
    exists: vi.fn(),
    metadata: vi.fn(),
  },
  path: {
    join: vi.fn(),
    dirname: vi.fn(),
    basename: vi.fn(),
    extname: vi.fn(),
    resolve: vi.fn(),
    normalize: vi.fn(),
    isAbsolute: vi.fn(),
  },
  shell: {
    open: vi.fn(),
  },
  window: {
    getCurrent: vi.fn(() => ({
      show: vi.fn(),
      hide: vi.fn(),
      close: vi.fn(),
      minimize: vi.fn(),
      maximize: vi.fn(),
      unmaximize: vi.fn(),
      isMaximized: vi.fn(),
      setTitle: vi.fn(),
      setFocus: vi.fn(),
    })),
  },
  notification: {
    sendNotification: vi.fn(),
    requestPermission: vi.fn(),
    isPermissionGranted: vi.fn(),
  },
}

// Mock @tauri-apps/api
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: mockTauriApi.invoke,
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockTauriApi.listen,
  emit: mockTauriApi.emit,
}))

vi.mock('@tauri-apps/api/dialog', () => mockTauriApi.dialog)

vi.mock('@tauri-apps/api/fs', () => mockTauriApi.fs)

vi.mock('@tauri-apps/api/path', () => mockTauriApi.path)

vi.mock('@tauri-apps/api/shell', () => mockTauriApi.shell)

vi.mock('@tauri-apps/api/window', () => mockTauriApi.window)

vi.mock('@tauri-apps/api/notification', () => mockTauriApi.notification)

// Mock framer-motion for simpler testing
vi.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
    span: 'span',
    p: 'p',
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    img: 'img',
    svg: 'svg',
    path: 'path',
    circle: 'circle',
    rect: 'rect',
    section: 'section',
    nav: 'nav',
    header: 'header',
    main: 'main',
    aside: 'aside',
    footer: 'footer',
    article: 'article',
    form: 'form',
    input: 'input',
    textarea: 'textarea',
    select: 'select',
    option: 'option',
    label: 'label',
    ul: 'ul',
    ol: 'ol',
    li: 'li',
    table: 'table',
    thead: 'thead',
    tbody: 'tbody',
    tr: 'tr',
    td: 'td',
    th: 'th',
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Search: () => 'svg',
  Filter: () => 'svg',
  X: () => 'svg',
  Plus: () => 'svg',
  Minus: () => 'svg',
  Settings: () => 'svg',
  Home: () => 'svg',
  FileText: () => 'svg',
  Folder: () => 'svg',
  Brain: () => 'svg',
  Zap: () => 'svg',
  Database: () => 'svg',
  ChevronRight: () => 'svg',
  ChevronDown: () => 'svg',
  ChevronLeft: () => 'svg',
  ChevronUp: () => 'svg',
  MoreHorizontal: () => 'svg',
  Download: () => 'svg',
  Upload: () => 'svg',
  Loader2: () => 'svg',
  CheckCircle: () => 'svg',
  XCircle: () => 'svg',
  AlertCircle: () => 'svg',
  Info: () => 'svg',
}))

// Global test utilities
export { mockTauriApi }

// Suppress console warnings in tests
global.console = {
  ...console,
  warn: vi.fn(),
  error: vi.fn(),
}

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})