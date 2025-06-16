export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 1) {
    const diffInMinutes = Math.floor(diffInHours * 60);
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
  } else if (diffInHours < 24) {
    const hours = Math.floor(diffInHours);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else if (diffInHours < 24 * 7) {
    const days = Math.floor(diffInHours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString();
  }
}

export function getFileIcon(extension?: string): string {
  if (!extension) return '📄';

  const ext = extension.toLowerCase();
  
  // Documents
  if (['pdf'].includes(ext)) return '📄';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['xls', 'xlsx'].includes(ext)) return '📊';
  if (['ppt', 'pptx'].includes(ext)) return '📽️';
  if (['txt', 'md', 'rtf'].includes(ext)) return '📃';
  
  // Images
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'svg'].includes(ext)) return '🖼️';
  if (['ico'].includes(ext)) return '🎨';
  
  // Audio
  if (['mp3', 'wav', 'aac', 'flac', 'm4a'].includes(ext)) return '🎵';
  
  // Video
  if (['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv'].includes(ext)) return '🎬';
  
  // Code
  if (['js', 'ts', 'jsx', 'tsx'].includes(ext)) return '⚡';
  if (['py'].includes(ext)) return '🐍';
  if (['java'].includes(ext)) return '☕';
  if (['cpp', 'c', 'h'].includes(ext)) return '⚙️';
  if (['rs'].includes(ext)) return '🦀';
  if (['go'].includes(ext)) return '🐹';
  if (['php'].includes(ext)) return '🐘';
  if (['rb'].includes(ext)) return '💎';
  if (['swift'].includes(ext)) return '🏎️';
  if (['kt'].includes(ext)) return '🎯';
  if (['html', 'htm'].includes(ext)) return '🌐';
  if (['css', 'scss', 'sass'].includes(ext)) return '🎨';
  if (['json', 'xml', 'yaml', 'yml'].includes(ext)) return '📋';
  if (['sql'].includes(ext)) return '🗃️';
  
  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '📦';
  
  // Executables
  if (['exe', 'msi', 'deb', 'rpm', 'dmg', 'pkg'].includes(ext)) return '⚡';
  if (['app'].includes(ext)) return '📱';
  
  // Fonts
  if (['ttf', 'otf', 'woff', 'woff2'].includes(ext)) return '🔤';
  
  // 3D/CAD
  if (['obj', 'fbx', 'dae', 'blend', 'max', 'dwg'].includes(ext)) return '🧊';
  
  // Default
  return '📄';
}

export function getMimeTypeFromExtension(extension?: string): string {
  if (!extension) return 'application/octet-stream';

  const ext = extension.toLowerCase();
  const mimeTypes: Record<string, string> = {
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'md': 'text/markdown',
    'rtf': 'application/rtf',
    
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'aac': 'audio/aac',
    'flac': 'audio/flac',
    'm4a': 'audio/m4a',
    
    // Video
    'mp4': 'video/mp4',
    'avi': 'video/avi',
    'mov': 'video/quicktime',
    'mkv': 'video/x-matroska',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    
    // Code
    'js': 'text/javascript',
    'ts': 'text/typescript',
    'jsx': 'text/jsx',
    'tsx': 'text/tsx',
    'py': 'text/x-python',
    'java': 'text/x-java',
    'cpp': 'text/x-c++src',
    'c': 'text/x-csrc',
    'h': 'text/x-chdr',
    'rs': 'text/x-rust',
    'go': 'text/x-go',
    'php': 'text/x-php',
    'rb': 'text/x-ruby',
    'swift': 'text/x-swift',
    'kt': 'text/x-kotlin',
    'html': 'text/html',
    'htm': 'text/html',
    'css': 'text/css',
    'scss': 'text/x-scss',
    'sass': 'text/x-sass',
    'json': 'application/json',
    'xml': 'application/xml',
    'yaml': 'application/x-yaml',
    'yml': 'application/x-yaml',
    'sql': 'application/sql',
    
    // Archives
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

export function getFileCategory(extension?: string): string {
  if (!extension) return 'unknown';

  const ext = extension.toLowerCase();
  
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'rtf'].includes(ext)) {
    return 'document';
  }
  
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'svg', 'ico'].includes(ext)) {
    return 'image';
  }
  
  if (['mp3', 'wav', 'aac', 'flac', 'm4a'].includes(ext)) {
    return 'audio';
  }
  
  if (['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv'].includes(ext)) {
    return 'video';
  }
  
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'rs', 'go', 'php', 'rb', 'swift', 'kt', 'html', 'htm', 'css', 'scss', 'sass', 'json', 'xml', 'yaml', 'yml', 'sql'].includes(ext)) {
    return 'code';
  }
  
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return 'archive';
  }
  
  if (['exe', 'msi', 'deb', 'rpm', 'dmg', 'pkg', 'app'].includes(ext)) {
    return 'executable';
  }
  
  return 'other';
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function highlightText(text: string, query: string): string {
  if (!query.trim()) return text;
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}