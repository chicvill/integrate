export const $ = (id) => document.getElementById(id);

export const DOC_ICONS = {
  pdf: '📕',
  doc: '📘',
  docx: '📘',
  xls: '📊',
  xlsx: '📊',
  ppt: '📙',
  pptx: '📙',
  txt: '📄',
  md: '📝',
  zip: '📦',
  rar: '📦',
  '7z': '📦',
  hwp: '📑',
};

export const state = {
  currentFolder: '',
  items: [],
  filteredItems: [],
  mediaItems: [],
  viewMode: 'grid',
  lightboxIdx: -1,
  isSelectMode: false,
  selectedPaths: new Set(),
  currentUploadMode: 'copy',
  sortBy: 'date_desc',
  filterType: 'all',
  favorites: new Set(JSON.parse(localStorage.getItem('mqnet_favorites') || '[]')),
  currentRotation: 0,
  slideshowTimer: null,
  storageInfo: null,
  lastSelectedIndex: -1,
  displayItems: []
};

export function saveFavorites() {
  localStorage.setItem('mqnet_favorites', JSON.stringify(Array.from(state.favorites)));
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
