/**
 * templates/saas-template/frontend/js/state.js
 * Reactive State Store for standard SaaS operations.
 * Supports Multi-Branch (다중 매장/지점) switching and isolated filtering.
 */

class AppState {
  constructor() {
    this.items = [];
    this.branches = [];
    this.currentBranchId = ''; // 빈 문자열: 전체 매장 관제
    this.statusFilter = '';
    this.searchKeyword = '';
    this.systemStatus = null;
    this.currentUser = null;
    this.listeners = [];
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this);
      } catch (err) {
        console.error('State listener error:', err);
      }
    }
  }

  setItems(items) {
    this.items = Array.isArray(items) ? items : [];
    this.notify();
  }

  setBranches(branches) {
    this.branches = Array.isArray(branches) ? branches : [];
    this.notify();
  }

  setCurrentBranch(branchId) {
    this.currentBranchId = branchId || '';
    this.notify();
  }

  setFilters(statusFilter, searchKeyword) {
    this.statusFilter = statusFilter;
    this.searchKeyword = searchKeyword;
    this.notify();
  }

  setSystemStatus(status) {
    this.systemStatus = status;
    this.notify();
  }

  setCurrentUser(user) {
    this.currentUser = user;
    this.notify();
  }

  getFilteredItems() {
    return this.items.filter(item => {
      const matchBranch = !this.currentBranchId || item.branch_id === this.currentBranchId;
      const matchStatus = !this.statusFilter || item.status === this.statusFilter;
      const matchSearch = !this.searchKeyword || 
        (item.title && item.title.toLowerCase().includes(this.searchKeyword.toLowerCase())) ||
        (item.detail && item.detail.toLowerCase().includes(this.searchKeyword.toLowerCase()));
      return matchBranch && matchStatus && matchSearch;
    });
  }
}

export const state = new AppState();
