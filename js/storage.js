/**
 * Real-time Storage Manager – Cross-Device Sync via ntfy.sh
 * 
 * SYNC PROTOCOL:
 *   - Small payloads (< 3800 bytes): sent as raw JSON directly
 *   - Large payloads: chunked with envelope {t:'C', id, i, tot, d}
 *   - Receiver handles both old raw JSON and new chunked protocol
 */

const STORAGE_KEY   = 'skill_roadmap_data_v1';
const AUTH_KEY      = 'skill_roadmap_user_auth';
const DEFAULT_CHANNEL = 'learnflow_sync_family_channel_2026';
const CHUNK_SIZE    = 3800; // ntfy.sh allows ~4096 bytes; stay safe

// Initial default demo courses (only used when localStorage is completely empty)
const DEFAULT_COURSES = [
  {
    id: 'course-1',
    title: 'Full Stack Web Development',
    description: 'Master Frontend, Backend, and Database building modern web apps.',
    category: 'Software Engineering',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sections: [
      {
        id: 'sec-1',
        title: 'Module 1: Modern HTML & CSS Architecture',
        topics: [
          { id: 'top-1', title: 'HTML5 Semantic Elements & SEO', hours: 1, completed: false },
          { id: 'top-2', title: 'CSS Flexbox & Responsive Layouts', hours: 2, completed: false },
          { id: 'top-3', title: 'CSS Grid & Modern Glassmorphism UI', hours: 2, completed: false },
          { id: 'top-4', title: 'Animations & Micro-interactions', hours: 1, completed: false }
        ]
      },
      {
        id: 'sec-2',
        title: 'Module 2: JavaScript Mastery (ES6+)',
        topics: [
          { id: 'top-5', title: 'Variables, Closures & Scope', hours: 1, completed: false },
          { id: 'top-6', title: 'Async/Await, Fetch API & JSON', hours: 2, completed: false },
          { id: 'top-7', title: 'DOM Manipulation & Event Loop', hours: 2, completed: false }
        ]
      }
    ]
  }
];

class StorageManager {
  constructor() {
    this.listeners    = [];
    this.eventSource  = null;
    this.chunks       = {};          // chunk reassembly buffer
    this.lastPushed   = '';          // last payload we sent, to avoid echo
    this.pollTimer    = null;

    this._initLocal();
    // Defer sync until DOM + network ready
    setTimeout(() => this._initRealtimeSync(), 500);
  }

  // ── LOCAL STORAGE ──────────────────────────────────────────────────────────

  _initLocal() {
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_COURSES));
    }
  }

  getCourses() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : DEFAULT_COURSES;
    } catch {
      return DEFAULT_COURSES;
    }
  }

  saveCourses(courses, syncToCloud = true) {
    // Safety: always store an array
    if (!Array.isArray(courses)) {
      console.warn('saveCourses: expected array, got', typeof courses);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
    window.dispatchEvent(new Event('roadmap_data_updated'));
    this.listeners.forEach(cb => cb(courses));
    if (syncToCloud) this._push(courses);
  }

  onDataChange(cb) { this.listeners.push(cb); }

  // ── CRUD HELPERS ───────────────────────────────────────────────────────────

  toggleTopicCompletion(courseId, topicId) {
    const courses = this.getCourses();
    const course  = courses.find(c => c.id === courseId);
    if (!course) return null;

    let hit = null, nowDone = false;
    for (const sec of course.sections) {
      for (const top of sec.topics) {
        if (top.id === topicId) {
          top.completed = !top.completed;
          hit = top; nowDone = top.completed;
        }
      }
    }
    if (hit) {
      course.updatedAt = new Date().toISOString();
      this.saveCourses(courses);
    }
    return hit ? { topic: hit, isCompleted: nowDone } : null;
  }

  addCourse(course) {
    const courses = this.getCourses();
    courses.unshift(course);
    this.saveCourses(courses);
    return course;
  }

  deleteCourse(courseId) {
    this.saveCourses(this.getCourses().filter(c => c.id !== courseId));
  }

  addTopicToCourse(courseId, topicTitle) {
    const courses = this.getCourses();
    const course  = courses.find(c => c.id === courseId);
    if (!course || !course.sections.length) return false;
    course.sections[0].topics.push({
      id: 'top-' + Date.now(),
      title: topicTitle,
      hours: 1,
      completed: false
    });
    course.updatedAt = new Date().toISOString();
    this.saveCourses(courses);
    return true;
  }

  // ── CHANNEL NAME ───────────────────────────────────────────────────────────

  getChannelName() {
    try {
      const auth = localStorage.getItem(AUTH_KEY);
      if (auth) {
        const { sharedCode } = JSON.parse(auth);
        if (sharedCode) {
          return 'learnflow_' + sharedCode.toLowerCase().replace(/[^a-z0-9]/g, '_');
        }
      }
    } catch {}
    return DEFAULT_CHANNEL;
  }

  // ── PUSH TO CLOUD ──────────────────────────────────────────────────────────

  async _push(courses) {
    try {
      const channel    = this.getChannelName();
      const payloadStr = JSON.stringify({ updatedAt: new Date().toISOString(), courses });
      this.lastPushed  = payloadStr;

      if (payloadStr.length <= CHUNK_SIZE) {
        // Small enough – send directly (also backwards-compatible with old receivers)
        await fetch(`https://ntfy.sh/${channel}`, {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : payloadStr
        });
      } else {
        // Large – split into labelled chunks
        const msgId  = Date.now().toString(36);
        const total  = Math.ceil(payloadStr.length / CHUNK_SIZE);
        for (let i = 0; i < total; i++) {
          const slice = payloadStr.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          await fetch(`https://ntfy.sh/${channel}`, {
            method: 'POST',
            body  : JSON.stringify({ _chunk: true, id: msgId, i, total, d: slice })
          });
          if (i < total - 1) await new Promise(r => setTimeout(r, 200));
        }
      }
    } catch (err) {
      console.warn('[LearnFlow] cloud push failed:', err);
    }
  }

  // ── RECEIVE MESSAGE ────────────────────────────────────────────────────────

  _receive(rawMessage) {
    if (!rawMessage) return;
    try {
      const msg = JSON.parse(rawMessage);

      // ── Chunked message ──────────────────────────────────────────────────
      if (msg._chunk === true) {
        const { id, i, total, d } = msg;
        if (!this.chunks[id]) this.chunks[id] = new Array(total).fill(null);
        this.chunks[id][i] = d;
        const allPresent = this.chunks[id].every(s => s !== null);
        if (!allPresent) return;
        const full = this.chunks[id].join('');
        delete this.chunks[id];
        this._applyPayload(full);
        return;
      }

      // ── Old-format full payload (backwards-compatible) ───────────────────
      if (msg.courses && Array.isArray(msg.courses)) {
        this._applyPayload(rawMessage);
        return;
      }
    } catch {}
  }

  _applyPayload(payloadStr) {
    // Don't echo our own push
    if (payloadStr === this.lastPushed) return;
    try {
      const { courses } = JSON.parse(payloadStr);
      if (!Array.isArray(courses)) return;
      const remote = JSON.stringify(courses);
      const local  = JSON.stringify(this.getCourses());
      if (remote === local) return;  // already in sync
      this.lastPushed = payloadStr;
      this.saveCourses(courses, false);  // false = don't re-push
    } catch {}
  }

  // ── PULL HISTORY ───────────────────────────────────────────────────────────

  async fetchHistoryFromCloud() {
    try {
      const channel = this.getChannelName();
      const res = await fetch(`https://ntfy.sh/${channel}/json?poll=1&since=12h`);
      if (!res.ok) return;
      const text  = await res.text();
      const lines = text.trim().split('\n').filter(Boolean);
      // Process in order so chunks reassemble correctly
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed?.message) this._receive(parsed.message);
        } catch {}
      }
    } catch (err) {
      console.warn('[LearnFlow] cloud pull failed:', err);
    }
  }

  // ── REALTIME INIT ──────────────────────────────────────────────────────────

  initRealtimeSync() { this._initRealtimeSync(); }  // public alias for app.js

  _initRealtimeSync() {
    // Pull latest on open
    this.fetchHistoryFromCloud();

    // SSE live stream
    this._openSSE();

    // Re-sync on tab focus / mobile wake
    window.addEventListener('focus', () => this.fetchHistoryFromCloud());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.fetchHistoryFromCloud();
    });

    // Heartbeat every 30s as ultimate fallback
    this._startPolling();
  }

  _openSSE() {
    try {
      if (this.eventSource) { this.eventSource.close(); this.eventSource = null; }
      const channel = this.getChannelName();
      this.eventSource = new EventSource(`https://ntfy.sh/${channel}/sse`);
      this.eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data?.message) this._receive(data.message);
        } catch {}
      };
      this.eventSource.onerror = () => {
        // SSE dropped – do an immediate poll then reconnect after 5 s
        this.fetchHistoryFromCloud();
        setTimeout(() => this._openSSE(), 5000);
      };
    } catch (err) {
      console.warn('[LearnFlow] SSE open failed:', err);
      setTimeout(() => this._openSSE(), 5000);
    }
  }

  _startPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => this.fetchHistoryFromCloud(), 30_000);
  }
}

export const storage = new StorageManager();
