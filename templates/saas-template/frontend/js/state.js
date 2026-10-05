/**
 * templates/saas-template/frontend/js/state.js
 * Reactive State Store for standard SaaS operations.
 */

class AppState {
  constructor() {
    this.items = [];
    this.statusFilter = '';
    this.searchKeyword = '';
    this.systemStatus = null;
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

  setFilters(statusFilter, searchKeyword) {
    this.statusFilter = statusFilter;
    this.searchKeyword = searchKeyword;
    this.notify();
  }

  setSystemStatus(status) {
    this.systemStatus = status;
    this.notify();
  }

  getFilteredItems() {
    return this.items.filter(item => {
      const matchStatus = !this.statusFilter || item.status === this.statusFilter;
      const matchSearch = !this.searchKeyword || 
        (item.title && item.title.toLowerCase().includes(this.searchKeyword.toLowerCase())) ||
        (item.detail && item.detail.toLowerCase().includes(this.searchKeyword.toLowerCase()));
      return matchStatus && matchSearch;
    });
  }
}

export const state = new AppState();
