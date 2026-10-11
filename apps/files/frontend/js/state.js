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
  lastSelectedPath: null, // Shift 범위 선택용 앵커

  // 클립보드 (복사 / 잘라내기)
  clipboard: {
    action: null, // 'copy' | 'cut' | null
    paths: [],
    scope: ''
  },

  // 현재 스토리지 범위: 'files' (기본 /media/files), 'all' (전체 /media), 'photos' (/media/photos), 'downloads' (/media/downloads)
  scope: 'files',

  // 뷰 모드: 'grid' (작은 아이콘 그리드) | 'list' (테이블)
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

  // 현재 사용자 및 플랜/쿼터 정보
  currentUser: 'demo_user',
  quota: null,

  // 스토리지 정보
  freeSpaceText: '',
  totalSizeText: '',
  storageRoot: '',

  // 통계
  totalCount: 0,

  // ── Helper Methods ────────────────────────────────────────

  reset() {
    this.selectedPaths.clear();
    this.lastSelectedPath = null;
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
    this.lastSelectedPath = null;
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

  getAllVisiblePaths() {
    return [
      ...this.folders.map(f => f.path),
      ...this.filteredFiles.map(f => f.path)
    ];
  },

  setSingleSelect(path) {
    this.selectedPaths = new Set([path]);
    this.lastSelectedPath = path;
  },

  toggleSelect(path) {
    if (this.selectedPaths.has(path)) {
      this.selectedPaths.delete(path);
      if (this.lastSelectedPath === path) {
        this.lastSelectedPath = this.selectedPaths.size > 0 ? Array.from(this.selectedPaths)[this.selectedPaths.size - 1] : null;
      }
    } else {
      this.selectedPaths.add(path);
      this.lastSelectedPath = path;
    }
  },

  selectRange(targetPath) {
    const allPaths = this.getAllVisiblePaths();
    if (!allPaths.includes(targetPath)) return;

    // 1. 기준이 될 마지막 선택 파일(anchor) 결정
    let anchor = this.lastSelectedPath;

    // 만약 lastSelectedPath가 없거나 현재 선택에 포함되어 있지 않다면,
    // 현재 선택된 파일들 중 화면 순서상 마지막 항목을 anchor로 자동 채택
    if (!anchor || !this.selectedPaths.has(anchor) || !allPaths.includes(anchor)) {
      if (this.selectedPaths.size > 0) {
        const selectedInOrder = allPaths.filter(p => this.selectedPaths.has(p));
        anchor = selectedInOrder[selectedInOrder.length - 1];
      }
    }

    // 여전히 anchor가 없다면 targetPath 단일 선택
    if (!anchor || !allPaths.includes(anchor)) {
      this.setSingleSelect(targetPath);
      return;
    }

    // 2. anchor와 targetPath 사이의 인덱스 범위 계산
    const startIdx = allPaths.indexOf(anchor);
    const endIdx = allPaths.indexOf(targetPath);
    if (startIdx === -1 || endIdx === -1) {
      this.setSingleSelect(targetPath);
      return;
    }

    const [minIdx, maxIdx] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
    for (let i = minIdx; i <= maxIdx; i++) {
      this.selectedPaths.add(allPaths[i]);
    }

    // 3. 마지막 선택된 파일(포커스/앵커)을 이번에 Shift 클릭한 targetPath로 갱신하여,
    // 다음 번 Shift+클릭 시에도 마지막 선택된 파일부터 연속 범위 선택이 가능하도록 설정
    this.lastSelectedPath = targetPath;
  },


  setSelection(paths) {
    this.selectedPaths = new Set(paths);
    if (paths.length > 0) {
      this.lastSelectedPath = paths[paths.length - 1];
    }
  },

  selectAll() {
    const all = this.getAllVisiblePaths();
    if (this.selectedPaths.size === all.length && all.length > 0) {
      this.selectedPaths.clear();
      this.lastSelectedPath = null;
    } else {
      this.selectedPaths = new Set(all);
      this.lastSelectedPath = all[all.length - 1] || null;
    }
  },

  clearSelection() {
    this.selectedPaths.clear();
    this.lastSelectedPath = null;
  },

  setClipboard(action, paths, scope) {
    this.clipboard = {
      action,
      paths: [...paths],
      scope: scope || this.scope
    };
  },

  clearClipboard() {
    this.clipboard = {
      action: null,
      paths: [],
      scope: ''
    };
  }
};

