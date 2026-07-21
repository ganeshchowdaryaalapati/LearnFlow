/**
 * Main Application Logic & UI Controller
 */

import { storage } from './storage.js';
import { parseChatGPTRoadmap } from './importer.js';
import { calculateCourseStats, calculateOverallStats } from './stats.js';
import { auth } from './auth.js';

class AppController {
  constructor() {
    this.courses = [];
    this.activeCourseId = null;
    this.collapsedSections = new Set();
    this.init();
  }

  init() {
    this.loadData();
    this.setupEventListeners();
    this.render();

    // Listen to real-time data sync across tabs or devices
    window.addEventListener('roadmap_data_updated', () => {
      this.loadData();
      this.render();
      this.showToast('⚡ Real-time sync update received!');
    });

    window.addEventListener('auth_state_changed', () => {
      this.render();
    });
  }

  loadData() {
    this.courses = storage.getCourses();
    if (this.courses.length > 0 && !this.activeCourseId) {
      this.activeCourseId = this.courses[0].id;
    }
  }

  getActiveCourse() {
    return this.courses.find(c => c.id === this.activeCourseId) || this.courses[0];
  }

  setupEventListeners() {
    // Add Course Modal Triggers
    const btnAddCourse = document.getElementById('btn-add-course');
    const btnImportChatGPT = document.getElementById('btn-import-chatgpt');
    const btnAccountShare = document.getElementById('btn-account-share');
    const btnManualSync = document.getElementById('btn-manual-sync');
    
    if (btnAddCourse) btnAddCourse.addEventListener('click', () => this.openModal('modal-add-course'));
    if (btnImportChatGPT) btnImportChatGPT.addEventListener('click', () => this.openModal('modal-import-chatgpt'));
    if (btnAccountShare) btnAccountShare.addEventListener('click', () => this.openModal('modal-auth'));

    if (btnManualSync) {
      btnManualSync.addEventListener('click', async () => {
        btnManualSync.style.transform = 'rotate(180deg)';
        btnManualSync.style.transition = 'transform 0.4s ease';
        this.showToast('🔄 Syncing with Cloud...');
        await storage.fetchHistoryFromCloud();
        setTimeout(() => { btnManualSync.style.transform = 'none'; }, 400);
      });
    }

    // Modal Close Buttons
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-backdrop');
        if (modal) modal.classList.remove('active');
      });
    });

    // Close modal on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
      });
    });

    // Add Course Form Submit
    const formAddCourse = document.getElementById('form-add-course');
    if (formAddCourse) {
      formAddCourse.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('new-course-title').value.trim();
        const category = document.getElementById('new-course-category').value.trim() || 'General';
        const description = document.getElementById('new-course-desc').value.trim();

        if (title) {
          const newCourse = {
            id: 'course-' + Date.now(),
            title,
            category,
            description: description || 'Personal learning roadmap',
            createdAt: new Date().toISOString(),
            sections: [
              {
                id: 'sec-' + Date.now(),
                title: 'Module 1: Getting Started',
                topics: [
                  { id: 'top-' + Date.now(), title: 'Introduction & Setup', hours: 1, completed: false }
                ]
              }
            ]
          };

          storage.addCourse(newCourse);
          this.activeCourseId = newCourse.id;
          this.closeModal('modal-add-course');
          formAddCourse.reset();
          this.showToast(`✨ Course "${title}" created! Syncing across devices...`);
          this.render();
        }
      });
    }

    // ChatGPT Import Form Submit
    const formImport = document.getElementById('form-import-chatgpt');
    if (formImport) {
      formImport.addEventListener('submit', (e) => {
        e.preventDefault();
        const rawText = document.getElementById('import-text').value;
        const customTitle = document.getElementById('import-title').value.trim();
        const category = document.getElementById('import-category').value.trim() || 'General';

        if (rawText.trim()) {
          const parsedCourse = parseChatGPTRoadmap(rawText, customTitle, category);
          storage.addCourse(parsedCourse);
          this.activeCourseId = parsedCourse.id;
          this.closeModal('modal-import-chatgpt');
          formImport.reset();
          this.showToast(`🚀 ChatGPT Roadmap "${parsedCourse.title}" imported!`);
          this.render();
        }
      });
    }

    // Auth Form Submit (Shared credentials)
    const formAuth = document.getElementById('form-auth');
    if (formAuth) {
      formAuth.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('auth-id').value.trim();
        const syncCode = document.getElementById('auth-sync-code').value.trim();
        if (id && syncCode) {
          auth.login(id, '123456', syncCode);
          storage.initRealtimeSync();
          this.closeModal('modal-auth');
          this.showToast(`🔐 Sync code updated to "${syncCode}"!`);
          this.render();
        }
      });
    }

    // Mobile Navigation Clicks
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.bottom-nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        const target = item.getAttribute('data-target');
        if (target === 'courses') {
          document.querySelector('.sidebar-panel')?.scrollIntoView({ behavior: 'smooth' });
        } else if (target === 'roadmap') {
          document.querySelector('.roadmap-container')?.scrollIntoView({ behavior: 'smooth' });
        } else if (target === 'account') {
          this.openModal('modal-auth');
        } else if (target === 'import') {
          this.openModal('modal-import-chatgpt');
        }
      });
    });
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  render() {
    this.renderHeaderUser();
    this.renderOverallStats();
    this.renderCourseList();
    this.renderActiveRoadmap();
  }

  renderHeaderUser() {
    const user = auth.getCurrentUser();
    const userDisplay = document.getElementById('user-account-badge');
    if (userDisplay) {
      userDisplay.innerText = user ? user.name : 'Shared Family Account';
    }
  }

  renderOverallStats() {
    const stats = calculateOverallStats(this.courses);

    const elCompletedHours = document.getElementById('stat-completed-hours');
    const elTotalTopics = document.getElementById('stat-total-topics');
    const elStreakDays = document.getElementById('stat-streak-days');

    if (elCompletedHours) elCompletedHours.innerText = `${stats.grandCompletedHours} / ${stats.grandTotalHours} hrs`;
    if (elTotalTopics) elTotalTopics.innerText = `${stats.grandCompletedTopics} / ${stats.grandTotalTopics}`;
    if (elStreakDays) elStreakDays.innerText = `${stats.streakDays} Days`;
  }

  renderCourseList() {
    const listContainer = document.getElementById('course-list-items');
    if (!listContainer) return;

    if (this.courses.length === 0) {
      listContainer.innerHTML = `<div class="subtext" style="padding: 1rem; text-align: center;">No courses yet. Click "+ Add Course" or "Import ChatGPT".</div>`;
      return;
    }

    listContainer.innerHTML = this.courses.map(course => {
      const stats = calculateCourseStats(course);
      const isActive = course.id === this.activeCourseId;

      return `
        <div class="course-item ${isActive ? 'active' : ''}" data-id="${course.id}">
          <div class="course-item-title">
            <span>${this.escapeHtml(course.title)}</span>
            <span style="font-size: 0.75rem; color: var(--accent-cyan); font-weight: 700;">${stats.percentage}%</span>
          </div>
          <div class="course-item-meta">
            <span>📚 ${stats.completedTopics}/${stats.totalTopics} topics</span>
            <span>⏱️ ${stats.completedHours}h completed</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${stats.percentage}%;"></div>
          </div>
        </div>
      `;
    }).join('');

    // Attach click handlers to course items
    listContainer.querySelectorAll('.course-item').forEach(item => {
      item.addEventListener('click', () => {
        this.activeCourseId = item.getAttribute('data-id');
        this.render();
      });
    });
  }

  renderActiveRoadmap() {
    const container = document.getElementById('roadmap-detail-panel');
    if (!container) return;

    const course = this.getActiveCourse();
    if (!course) {
      container.innerHTML = `<div class="subtext" style="text-align: center; padding: 2rem;">Select or create a course to view roadmap.</div>`;
      return;
    }

    const stats = calculateCourseStats(course);

    let html = `
      <div class="roadmap-top-bar">
        <div class="roadmap-title-area">
          <div style="font-size: 0.8rem; color: var(--accent-cyan); font-weight: 700; text-transform: uppercase; margin-bottom: 0.2rem;">
            ${this.escapeHtml(course.category || 'Course Roadmap')}
          </div>
          <h2>${this.escapeHtml(course.title)}</h2>
          <p class="subtext">${this.escapeHtml(course.description || '')}</p>
        </div>
        <div class="roadmap-actions">
          <button class="btn btn-secondary btn-sm" id="btn-add-section-topic">
            <span>+ Add Topic</span>
          </button>
          <button class="btn btn-secondary btn-sm" id="btn-delete-course" style="color: var(--accent-rose);">
            <span>🗑️ Delete Course</span>
          </button>
        </div>
      </div>

      <!-- Course Progress Bar -->
      <div style="margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.4rem;">
          <span>Overall Course Progress</span>
          <span style="color: var(--accent-emerald);">${stats.completedTopics} of ${stats.totalTopics} Topics (${stats.percentage}%)</span>
        </div>
        <div class="progress-bar-bg" style="height: 10px;">
          <div class="progress-bar-fill" style="width: ${stats.percentage}%; background: var(--grad-success);"></div>
        </div>
      </div>
    `;

    // Render Sections
    course.sections.forEach(sec => {
      const isCollapsed = this.collapsedSections.has(sec.id);
      
      html += `
        <div class="roadmap-section">
          <div class="section-header" data-sec-id="${sec.id}">
            <div class="section-title">
              <span>${isCollapsed ? '►' : '▼'}</span>
              <span>${this.escapeHtml(sec.title)}</span>
            </div>
            <span style="font-size: 0.8rem; color: var(--text-muted);">
              ${sec.topics.filter(t => t.completed).length}/${sec.topics.length} Done
            </span>
          </div>

          <div class="topic-list" style="display: ${isCollapsed ? 'none' : 'flex'};">
            ${sec.topics.map(topic => `
              <div class="topic-card ${topic.completed ? 'completed' : ''}" data-topic-id="${topic.id}">
                <div class="topic-left">
                  <div class="custom-checkbox ${topic.completed ? 'checked' : ''}" data-topic-id="${topic.id}">
                    <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <span class="topic-name">${this.escapeHtml(topic.title)}</span>
                </div>
                <div class="topic-meta">
                  <span class="time-pill">⏱️ ${topic.hours || 1} hr</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Attach Section Collapse/Expand Handlers
    container.querySelectorAll('.section-header').forEach(header => {
      header.addEventListener('click', () => {
        const secId = header.getAttribute('data-sec-id');
        if (this.collapsedSections.has(secId)) {
          this.collapsedSections.delete(secId);
        } else {
          this.collapsedSections.add(secId);
        }
        this.renderActiveRoadmap();
      });
    });

    // Attach Checkbox Click Handlers (Cross-device tick state toggle)
    container.querySelectorAll('.custom-checkbox').forEach(chk => {
      chk.addEventListener('click', (e) => {
        e.stopPropagation();
        const topicId = chk.getAttribute('data-topic-id');
        const res = storage.toggleTopicCompletion(this.activeCourseId, topicId);
        
        if (res && res.topic) {
          if (res.isCompleted) {
            this.showToast(`✅ Marked "${res.topic.title}" as completed! (+${res.topic.hours} hrs)`);
          } else {
            this.showToast(`📌 Marked "${res.topic.title}" as pending.`);
          }
          this.render();
        }
      });
    });

    // Delete Course Button Handler
    const btnDelete = container.querySelector('#btn-delete-course');
    if (btnDelete) {
      btnDelete.addEventListener('click', () => {
        if (confirm(`Are you sure you want to delete course "${course.title}"?`)) {
          storage.deleteCourse(course.id);
          this.activeCourseId = null;
          this.loadData();
          this.showToast('🗑️ Course deleted.');
          this.render();
        }
      });
    }

    // Add Topic Quick Handler
    const btnAddTopic = container.querySelector('#btn-add-section-topic');
    if (btnAddTopic) {
      btnAddTopic.addEventListener('click', () => {
        const title = prompt('Enter new topic title:');
        if (title && title.trim()) {
          const added = storage.addTopicToCourse(this.activeCourseId, title.trim());
          if (added) {
            this.showToast(`✨ Topic "${title.trim()}" added! Syncing...`);
            this.loadData();
            this.render();
          }
        }
      });
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[m];
    });
  }
}

// Initialize Application once DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
});
