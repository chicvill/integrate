// apps/files/frontend/js/state.js
// MQnet Files Hub - 전역 반응형 상태 저장소

export const state = {
  // 현재 탐색 상태
  currentPath: '',
  breadcrumbs: [],
  folders: [],
  files: [],
  filteredFiles: [],

  // 로딩 / 에러
  isLoading: false,
  errorMessage: null,

  // 선택 항목 (다중 선택)
  selectedPaths: new Set(),

  // 뷰 모드: 'grid' | 'list'
  viewMode: 'grid',

  // 파일 타입 필터: 'all' | 'image' | 'video' | 'audio' | 'document' | 'code' | 'archive'
  activeFilter: 'all',

  // 검색 상태
  isSearchMode: false,
  searchQuery: '',
  searchResults: [],

  // 정렬: 'name' | 'size' | 'modified'
  sortField: 'name',
  sortAsc: true,

  // 스토리지 정보
  freeSpaceText: '',
  totalSizeText: '',
  storageRoot: '',

  // 통계
  totalCount: 0,

  // ── Helper Methods ────────────────────────────────────────

  reset() {
    this.selectedPaths.clear();
    this.errorMessage = null;
  },

  setFolderData(data) {
    this.currentPath = data.current_path || '';
    this.breadcrumbs = data.breadcrumbs || [];
    this.folders = data.folders || [];
    this.files = data.files || [];
    this.totalCount = data.total_count || 0;
    this.freeSpaceText = data.free_space_formatted || '';
    this.totalSizeText = data.total_size_formatted || '';
    this.storageRoot = data.storage_root || '';
    this.selectedPaths.clear();
    this.applyFilterAndSort();
  },

  applyFilterAndSort() {
    let filtered = [...this.files];

    // 카테고리 필터
    if (this.activeFilter !== 'all') {
      filtered = filtered.filter(f => f.category === this.activeFilter);
    }

    // 검색어 필터 (폴더 목록에서는 검색 모드 사용)
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(f => f.name.toLowerCase().includes(q));
    }

    // 정렬
    filtered.sort((a, b) => {
      let va = a[this.sortField] ?? '';
      let vb = b[this.sortField] ?? '';
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return this.sortAsc ? cmp : -cmp;
    });

    this.filteredFiles = filtered;
  },

  toggleSelect(path) {
    if (this.selectedPaths.has(path)) {
      this.selectedPaths.delete(path);
    } else {
      this.selectedPaths.add(path);
    }
  },

  selectAll() {
    const all = [
      ...this.folders.map(f => f.path),
      ...this.filteredFiles.map(f => f.path)
    ];
    if (this.selectedPaths.size === all.length) {
      this.selectedPaths.clear();
    } else {
      this.selectedPaths = new Set(all);
    }
  },

  clearSelection() {
    this.selectedPaths.clear();
  }
};
