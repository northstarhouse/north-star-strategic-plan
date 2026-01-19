const { useState, useEffect, useMemo } = React;

// =====================================================================
// LOCAL CACHE CONFIG
// =====================================================================

const CACHE_KEY = 'nsh-strategy-cache-v1';
const CACHE_TTL_MS = 5 * 60 * 1000;

const readCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.objects)) return null;
    return parsed;
  } catch (error) {
    console.warn('Failed to read cache:', error);
    return null;
  }
};

const writeCache = (objects) => {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ objects, updatedAt: Date.now() })
    );
  } catch (error) {
    console.warn('Failed to write cache:', error);
  }
};

// ============================================================================
// GOOGLE SHEETS CONFIGURATION
// ============================================================================

const USE_SHEETS = true;
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwAGcXEtvH2joUHb0k1UxWSs8MYRqpUE-fn8wERcPxEQ9rK8hVGWcKnP7lpoWl7nNzM2A/exec';
const DRIVE_SCRIPT_URL = GOOGLE_SCRIPT_URL;

// ============================================================================
// DROPDOWN OPTIONS
// ============================================================================

const FOCUS_AREAS = [
  'Fund Development',
  'House and Grounds Development',
  'Programs and Events',
  'Organizational Development'
];

const STATUSES = [
  'Not started',
  'On track',
  'At risk',
  'Behind',
  'Complete'
];

const REVIEW_STATUSES = [
  'Pending',
  'Reviewed',
  'Needs info'
];

const PROGRESS_OPTIONS = Array.from({ length: 11 }, (_, idx) => idx * 10);

// ============================================================================
// FALLBACK SAMPLE DATA
// ============================================================================

const SAMPLE_INITIATIVES = [
  {
    id: '1',
    title: 'Launch community listening series',
    focusArea: 'Programs and Events',
    description: 'Host quarterly listening sessions to guide program priorities and gather feedback.',
    owner: 'Community Outreach Lead',
    coChampions: 'Program Director, Board Liaison',
    status: 'On track',
    progress: 60,
    targetDate: '2026-03-31',
    successMetrics: '4 sessions held, 120 participants, report delivered to board',
    threeYearVision: 'A consistent community-informed events calendar with sustained attendance growth.',
    annualGoals: 'Host 4 sessions, publish summary report, build annual outreach playbook.',
    notes: 'Align session topics with strategic planning themes.',
    lastUpdateAt: '2026-01-12T18:30:00.000Z',
    updates: [
      {
        id: 'up-1',
        date: '2026-01-12T18:30:00.000Z',
        author: 'Community Outreach Lead',
        summary: 'Secured first three locations',
        details: 'Libraries and partner agencies confirmed for January and February sessions.',
        blockers: 'Waiting on translation support budget confirmation.',
        nextSteps: 'Finalize outreach materials and RSVP form.',
        progress: 60,
        links: 'https://example.com/agenda',
        reviewStatus: 'Pending',
        reviewNotes: ''
      }
    ],
    createdAt: '2025-11-15T12:00:00.000Z',
    updatedAt: '2026-01-12T18:30:00.000Z'
  },
  {
    id: '2',
    title: 'Build leadership succession pipeline',
    focusArea: 'Organizational Development',
    description: 'Create leadership development plan and identify emerging leaders for key roles.',
    owner: 'Executive Director',
    coChampions: 'Board Chair, HR Committee',
    status: 'At risk',
    progress: 35,
    targetDate: '2026-09-30',
    successMetrics: 'Pipeline matrix completed, two leaders in shadow roles',
    threeYearVision: 'Succession plan is routine, leadership bench is stable and supported.',
    annualGoals: 'Finalize competencies, identify 2 shadow roles, launch mentoring cadence.',
    notes: 'Need agreement on competencies and mentorship structure.',
    lastUpdateAt: '2025-12-18T17:05:00.000Z',
    updates: [
      {
        id: 'up-2',
        date: '2025-12-18T17:05:00.000Z',
        author: 'Executive Director',
        summary: 'Drafted role competency framework',
        details: 'Outlined core competencies for leadership roles; awaiting committee review.',
        blockers: 'Committee schedule conflict in January.',
        nextSteps: 'Hold workshop to finalize framework.',
        progress: 35,
        links: '',
        reviewStatus: 'Needs info',
        reviewNotes: 'Please add timeline impact for delayed workshop.'
      }
    ],
    createdAt: '2025-10-01T09:00:00.000Z',
    updatedAt: '2025-12-18T17:05:00.000Z'
  }
];

// ============================================================================
// GOOGLE SHEETS API FUNCTIONS
// ============================================================================

const SheetsAPI = {
  isConfigured: () => USE_SHEETS && GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL.length > 0,

  postJson: async (url, payload) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Request failed');
    return response.json();
  },

  fetchAll: async () => {
    if (!USE_SHEETS) {
      const cached = readCache();
      return cached?.objects || [];
    }
    if (!SheetsAPI.isConfigured()) {
      console.log('Google Sheets not configured, using sample data');
      return SAMPLE_INITIATIVES;
    }

    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getAll`);
      if (!response.ok) throw new Error('Failed to fetch data');
      const data = await response.json();
      return data.objects || [];
    } catch (error) {
      console.error('Error fetching from Google Sheets:', error);
      return SAMPLE_INITIATIVES;
    }
  },

  create: async (object) => {
    if (!SheetsAPI.isConfigured()) {
      console.log('Google Sheets not configured, saving locally only');
      return { ...object, id: Date.now().toString() };
    }

    try {
      const data = await SheetsAPI.postJson(GOOGLE_SCRIPT_URL, { action: 'create', object });
      return data.result || { ...object, id: Date.now().toString() };
    } catch (error) {
      console.error('Error creating in Google Sheets:', error);
      return { ...object, id: Date.now().toString() };
    }
  },

  update: async (object) => {
    if (!SheetsAPI.isConfigured()) {
      console.log('Google Sheets not configured, saving locally only');
      return object;
    }

    try {
      await SheetsAPI.postJson(GOOGLE_SCRIPT_URL, { action: 'update', object });
      return object;
    } catch (error) {
      console.error('Error updating from Google Sheets:', error);
      return object;
    }
  },

  delete: async (id) => {
    if (!SheetsAPI.isConfigured()) {
      console.log('Google Sheets not configured');
      return true;
    }

    try {
      await SheetsAPI.postJson(GOOGLE_SCRIPT_URL, { action: 'delete', id });
      return true;
    } catch (error) {
      console.error('Error deleting from Google Sheets:', error);
      return false;
    }
  },

  uploadFile: async ({ filename, mimeType, data }) => {
    if (!DRIVE_SCRIPT_URL) {
      throw new Error('Drive upload not configured');
    }

    const payload = {
      action: 'uploadImage',
      filename,
      mimeType,
      data
    };

    const response = await SheetsAPI.postJson(DRIVE_SCRIPT_URL, payload);
    if (!response.success) throw new Error(response.error || 'Upload failed');
    return response.result;
  },

  fetchMetrics: async () => {
    if (!SheetsAPI.isConfigured()) {
      return null;
    }
    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getMetrics`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json();
      return data.metrics || null;
    } catch (error) {
      console.error('Error fetching metrics:', error);
      return null;
    }
  }
};

// ============================================================================
// HELPERS
// ============================================================================

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;

const formatDate = (value) => {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (error) {
    return value;
  }
};

const formatCount = (value) => {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US').format(Number(value) || 0);
};

const formatCurrency = (value) => {
  if (value === null || value === undefined) return 'N/A';
  const amount = Number(value) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);
};

const normalizeInitiative = (item) => ({
  ...item,
  focusArea: item.focusArea || item.pillar || '',
  progress: Number(item.progress) || 0,
  updates: Array.isArray(item.updates) ? item.updates : []
});

const sortUpdates = (updates) =>
  updates.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

const statusClass = (status) => {
  switch (status) {
    case 'On track':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'At risk':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'Behind':
      return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'Complete':
      return 'bg-ocean text-white border-ocean';
    default:
      return 'bg-stone-100 text-stone-600 border-stone-200';
  }
};

const reviewClass = (status) => {
  switch (status) {
    case 'Reviewed':
      return 'text-emerald-700';
    case 'Needs info':
      return 'text-rose-700';
    default:
      return 'text-amber-700';
  }
};

// ============================================================================
// ICONS
// ============================================================================

const IconSpark = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6L3.5 10.5 9.5 8z"></path>
  </svg>
);

const IconTarget = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"></circle>
    <circle cx="12" cy="12" r="5"></circle>
    <circle cx="12" cy="12" r="1"></circle>
  </svg>
);

const IconStar = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2.8l2.7 5.7 6.3.9-4.5 4.4 1.1 6.2L12 17.8 6.4 20l1.1-6.2-4.5-4.4 6.3-.9L12 2.8z"></path>
  </svg>
);

const IconPlus = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14"></path>
    <path d="M5 12h14"></path>
  </svg>
);

const IconArrow = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14"></path>
    <path d="M13 5l7 7-7 7"></path>
  </svg>
);

const IconBack = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5"></path>
    <path d="M11 5l-7 7 7 7"></path>
  </svg>
);

const IconRefresh = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 15.3-6.3"></path>
    <path d="M21 12a9 9 0 0 1-15.3 6.3"></path>
    <path d="M18 6v4h-4"></path>
    <path d="M6 18v-4h4"></path>
  </svg>
);

// ============================================================================
// UI COMPONENTS
// ============================================================================

const ProgressBar = ({ value }) => (
  <div className="w-full bg-stone-100 rounded-full h-3 overflow-hidden">
    <div
      className="h-full bg-clay transition-all"
      style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
    ></div>
  </div>
);

const StatusPill = ({ status }) => (
  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${statusClass(status)}`}>
    {status}
  </span>
);

const KpiCard = ({ label, value, helper }) => (
  <div className="glass rounded-2xl p-4 md:p-5 card-shadow">
    <div className="text-xs uppercase tracking-wide text-steel">{label}</div>
    <div className="text-2xl font-display text-ink mt-2">{value}</div>
    {helper && <div className="text-xs text-steel mt-1">{helper}</div>}
  </div>
);

const InitiativeCard = ({ initiative, onSelect }) => (
  <button
    onClick={onSelect}
    className="text-left bg-white rounded-2xl border border-stone-100 p-5 card-shadow hover:-translate-y-0.5 transition-transform"
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-xs uppercase tracking-wide text-steel">{initiative.focusArea}</div>
        <h3 className="font-display text-xl text-ink mt-1">{initiative.title}</h3>
      </div>
      <StatusPill status={initiative.status} />
    </div>
    <p className="text-sm text-stone-600 mt-3">{initiative.description}</p>
    <div className="mt-4">
      <div className="flex items-center justify-between text-xs text-steel mb-2">
        <span>{Math.round(initiative.progress)}% complete</span>
        <span>Target: {initiative.targetDate || 'TBD'}</span>
      </div>
      <ProgressBar value={initiative.progress} />
    </div>
    <div className="flex items-center justify-between text-xs text-steel mt-4">
      <span>Goal lead: {initiative.owner || 'Unassigned'}</span>
      <span>Last update: {formatDate(initiative.lastUpdateAt)}</span>
    </div>
  </button>
);

const UpdateCard = ({ update, onReviewSave }) => {
  const [reviewStatus, setReviewStatus] = useState(update.reviewStatus || 'Pending');
  const [reviewNotes, setReviewNotes] = useState(update.reviewNotes || '');

  return (
    <div className="bg-white rounded-2xl border border-stone-100 p-5 card-shadow">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-steel">{formatDate(update.date)}</div>
          <h4 className="font-display text-lg text-ink mt-1">{update.summary || 'Update'}</h4>
          <p className="text-sm text-stone-600">Submitted by {update.author || 'Team member'}</p>
        </div>
        <div className={`text-xs font-semibold ${reviewClass(reviewStatus)}`}>
          {reviewStatus}
        </div>
      </div>
      {update.details && <p className="text-sm text-stone-700 mt-3 whitespace-pre-wrap">{update.details}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-stone-600 mt-4">
        <div>
          <div className="uppercase tracking-wide text-steel">Blockers</div>
          <div>{update.blockers || 'None noted'}</div>
        </div>
        <div>
          <div className="uppercase tracking-wide text-steel">Next steps</div>
          <div>{update.nextSteps || 'No next steps yet'}</div>
        </div>
        <div>
          <div className="uppercase tracking-wide text-steel">Progress</div>
          <div>{typeof update.progress === 'number' ? `${Math.round(update.progress)}%` : 'Not shared'}</div>
        </div>
      </div>
      {update.links && (
        <div className="mt-3 text-xs text-ocean">
          <a href={update.links} target="_blank" rel="noreferrer" className="underline">
            View supporting link
          </a>
        </div>
      )}
      <div className="mt-4 pt-4 border-t border-stone-100">
        <div className="text-xs uppercase tracking-wide text-steel">Co-champion review</div>
        <div className="flex flex-col md:flex-row md:items-center gap-3 mt-2">
          <select
            value={reviewStatus}
            onChange={(event) => setReviewStatus(event.target.value)}
            className="px-3 py-2 border border-stone-200 rounded-lg bg-white text-sm"
          >
            {REVIEW_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <input
            type="text"
            value={reviewNotes}
            onChange={(event) => setReviewNotes(event.target.value)}
            placeholder="Review notes"
            className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm"
          />
          <button
            onClick={() => onReviewSave(update.id, reviewStatus, reviewNotes)}
            className="px-4 py-2 bg-ocean text-white rounded-lg text-sm"
          >
            Save review
          </button>
        </div>
      </div>
    </div>
  );
};

const UpdateForm = ({ initiative, onSubmit }) => {
  const [author, setAuthor] = useState('');
  const [summary, setSummary] = useState('');
  const [details, setDetails] = useState('');
  const [blockers, setBlockers] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [progress, setProgress] = useState(initiative.progress || 0);
  const [links, setLinks] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const update = {
      id: makeId(),
      date: new Date().toISOString(),
      author,
      summary,
      details,
      blockers,
      nextSteps,
      progress: Number(progress) || 0,
      links,
      reviewStatus: 'Pending',
      reviewNotes: ''
    };
    onSubmit(update);
    setAuthor('');
    setSummary('');
    setDetails('');
    setBlockers('');
    setNextSteps('');
    setProgress(initiative.progress || 0);
    setLinks('');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-stone-100 p-5 card-shadow">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl">Submit progress update</h3>
        <span className="text-xs text-steel">Visible to board members</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Your name</label>
          <input
            type="text"
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
            placeholder="Name or team"
            required
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Update headline</label>
          <input
            type="text"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
            placeholder="Short summary"
            required
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs uppercase tracking-wide text-steel">Details</label>
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg min-h-[120px]"
            placeholder="What changed? What decisions were made?"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Blockers</label>
          <input
            type="text"
            value={blockers}
            onChange={(event) => setBlockers(event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
            placeholder="Risks or constraints"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Next steps</label>
          <input
            type="text"
            value={nextSteps}
            onChange={(event) => setNextSteps(event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
            placeholder="Immediate actions"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Updated progress</label>
          <select
            value={progress}
            onChange={(event) => setProgress(event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg bg-white"
          >
            {PROGRESS_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}%</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Supporting link</label>
          <input
            type="url"
            value={links}
            onChange={(event) => setLinks(event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
            placeholder="https://"
          />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end">
        <button type="submit" className="px-5 py-2 bg-clay text-white rounded-lg">Submit update</button>
      </div>
    </form>
  );
};

const InitiativeForm = ({ initiative, onSave, onCancel, isSaving }) => {
  const [form, setForm] = useState(() => ({
    title: initiative?.title || '',
    focusArea: initiative?.focusArea || '',
    description: initiative?.description || '',
    owner: initiative?.owner || '',
    coChampions: initiative?.coChampions || '',
    status: initiative?.status || STATUSES[0],
    progress: initiative?.progress || 0,
    targetDate: initiative?.targetDate || '',
    successMetrics: initiative?.successMetrics || '',
    threeYearVision: initiative?.threeYearVision || '',
    annualGoals: initiative?.annualGoals || '',
    notes: initiative?.notes || ''
  }));

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const next = {
      ...initiative,
      ...form,
      progress: Number(form.progress) || 0,
      updates: initiative?.updates || []
    };
    onSave(next);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-stone-100 p-6 card-shadow">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">{initiative ? 'Edit initiative' : 'Add initiative'}</h2>
        <span className="text-xs text-steel">Visible to board leaders</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        <div className="md:col-span-2">
          <label className="text-xs uppercase tracking-wide text-steel">Initiative title</label>
          <input
            type="text"
            value={form.title}
            onChange={(event) => updateField('title', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
            required
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Focus area</label>
          <select
            value={form.focusArea}
            onChange={(event) => updateField('focusArea', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg bg-white"
          >
            <option value="">Select focus area</option>
            {FOCUS_AREAS.map((focusArea) => (
              <option key={focusArea} value={focusArea}>{focusArea}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Goal lead</label>
          <input
            type="text"
            value={form.owner}
            onChange={(event) => updateField('owner', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
            placeholder="Lead or team"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs uppercase tracking-wide text-steel">Description</label>
          <textarea
            value={form.description}
            onChange={(event) => updateField('description', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg min-h-[120px]"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Co-champions</label>
          <input
            type="text"
            value={form.coChampions}
            onChange={(event) => updateField('coChampions', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
            placeholder="Names or roles"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Status</label>
          <select
            value={form.status}
            onChange={(event) => updateField('status', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg bg-white"
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Progress</label>
          <select
            value={form.progress}
            onChange={(event) => updateField('progress', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg bg-white"
          >
            {PROGRESS_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}%</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Target date</label>
          <input
            type="date"
            value={form.targetDate}
            onChange={(event) => updateField('targetDate', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs uppercase tracking-wide text-steel">Success metrics</label>
          <input
            type="text"
            value={form.successMetrics}
            onChange={(event) => updateField('successMetrics', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
            placeholder="What does success look like?"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs uppercase tracking-wide text-steel">Three-year vision for success</label>
          <textarea
            value={form.threeYearVision}
            onChange={(event) => updateField('threeYearVision', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg min-h-[100px]"
            placeholder="Describe what success looks like in three years."
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs uppercase tracking-wide text-steel">Annual goals</label>
          <textarea
            value={form.annualGoals}
            onChange={(event) => updateField('annualGoals', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg min-h-[100px]"
            placeholder="List the annual goals that move this forward."
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs uppercase tracking-wide text-steel">Notes</label>
          <textarea
            value={form.notes}
            onChange={(event) => updateField('notes', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg min-h-[100px]"
          />
        </div>
      </div>
      <div className="mt-6 flex items-center justify-end gap-3">
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-stone-200 rounded-lg">
          Cancel
        </button>
        <button type="submit" disabled={isSaving} className="px-5 py-2 bg-ocean text-white rounded-lg">
          {isSaving ? 'Saving...' : 'Save initiative'}
        </button>
      </div>
    </form>
  );
};

// ============================================================================
// QUARTERLY UPDATE FORM
// ============================================================================

const QuarterlyUpdateForm = () => {
  const [form, setForm] = useState({
    focusArea: '',
    quarter: '',
    year: new Date().getFullYear().toString(),
    submittedDate: new Date().toISOString().slice(0, 10),
    primaryFocus: '',
    goals: [
      { goal: '', status: 'On Track', summary: '' },
      { goal: '', status: 'On Track', summary: '' },
      { goal: '', status: 'On Track', summary: '' }
    ],
    wins: '',
    challenges: {
      capacity: false,
      budget: false,
      scheduling: false,
      coordination: false,
      external: false,
      other: false,
      otherText: '',
      details: ''
    },
    supportNeeded: '',
    supportAreas: '',
    supportTypes: {
      staff: false,
      marketing: false,
      board: false,
      funding: false,
      facilities: false,
      other: false,
      otherText: ''
    },
    crossHelp: '',
    nextPriorities: ['', '', ''],
    decisionsNeeded: '',
    strategicAlignment: '',
    review: {
      assessment: '',
      actions: '',
      followUps: '',
      reviewDate: '',
      leadSignature: '',
      championSignature: ''
    }
  });

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateGoal = (index, field, value) => {
    setForm((prev) => {
      const goals = prev.goals.map((goal, idx) =>
        idx === index ? { ...goal, [field]: value } : goal
      );
      return { ...prev, goals };
    });
  };

  const updateChallenge = (field, value) => {
    setForm((prev) => ({
      ...prev,
      challenges: { ...prev.challenges, [field]: value }
    }));
  };

  const updateSupportType = (field, value) => {
    setForm((prev) => ({
      ...prev,
      supportTypes: { ...prev.supportTypes, [field]: value }
    }));
  };

  const updatePriority = (index, value) => {
    setForm((prev) => {
      const nextPriorities = prev.nextPriorities.map((item, idx) =>
        idx === index ? value : item
      );
      return { ...prev, nextPriorities };
    });
  };

  const updateReview = (field, value) => {
    setForm((prev) => ({
      ...prev,
      review: { ...prev.review, [field]: value }
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    alert('Quarterly update submitted.');
  };

  return (
    <div className="max-w-4xl mx-auto fade-up">
      <div className="bg-white rounded-3xl border border-stone-100 p-6 md:p-8 card-shadow">
        <h1 className="font-display text-3xl text-ink">Quarterly Strategic Area Update Form</h1>
        <p className="text-stone-600 mt-2">
          Share quarterly progress, challenges, and support needs for each focus area.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-steel">Organizational area</label>
              <select
                value={form.focusArea}
                onChange={(event) => updateField('focusArea', event.target.value)}
                className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg bg-white"
                required
              >
                <option value="">Select area</option>
                {FOCUS_AREAS.map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-steel">Quarter</label>
              <select
                value={form.quarter}
                onChange={(event) => updateField('quarter', event.target.value)}
                className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg bg-white"
                required
              >
                <option value="">Select quarter</option>
                {['Q1', 'Q2', 'Q3', 'Q4'].map((quarter) => (
                  <option key={quarter} value={quarter}>{quarter}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-steel">Year</label>
              <input
                type="text"
                value={form.year}
                onChange={(event) => updateField('year', event.target.value)}
                className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-steel">Date submitted</label>
              <input
                type="date"
                value={form.submittedDate}
                onChange={(event) => updateField('submittedDate', event.target.value)}
                className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-steel">
              Primary focus this quarter
            </label>
            <textarea
              value={form.primaryFocus}
              onChange={(event) => updateField('primaryFocus', event.target.value)}
              className="w-full mt-2 px-3 py-2 border border-stone-200 rounded-lg min-h-[120px]"
              placeholder="Main priorities or themes."
            />
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-steel">Quarterly goals and status</div>
            <div className="mt-3 space-y-4">
              {form.goals.map((goal, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-[1.2fr_0.6fr_1fr] gap-3">
                  <input
                    type="text"
                    value={goal.goal}
                    onChange={(event) => updateGoal(index, 'goal', event.target.value)}
                    className="px-3 py-2 border border-stone-200 rounded-lg"
                    placeholder={`Goal ${index + 1}`}
                  />
                  <select
                    value={goal.status}
                    onChange={(event) => updateGoal(index, 'status', event.target.value)}
                    className="px-3 py-2 border border-stone-200 rounded-lg bg-white"
                  >
                    {['On Track', 'At Risk', 'Off Track'].map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={goal.summary}
                    onChange={(event) => updateGoal(index, 'summary', event.target.value)}
                    className="px-3 py-2 border border-stone-200 rounded-lg"
                    placeholder="Progress summary"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-steel">What went well</label>
            <textarea
              value={form.wins}
              onChange={(event) => updateField('wins', event.target.value)}
              className="w-full mt-2 px-3 py-2 border border-stone-200 rounded-lg min-h-[120px]"
              placeholder="Milestones, events, completed projects."
            />
          </div>

          <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100">
            <div className="text-xs uppercase tracking-wide text-steel">Challenges encountered</div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-stone-700">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.challenges.capacity} onChange={(event) => updateChallenge('capacity', event.target.checked)} />
                Capacity or volunteer limitations
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.challenges.budget} onChange={(event) => updateChallenge('budget', event.target.checked)} />
                Budget or funding constraints
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.challenges.scheduling} onChange={(event) => updateChallenge('scheduling', event.target.checked)} />
                Scheduling or timing issues
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.challenges.coordination} onChange={(event) => updateChallenge('coordination', event.target.checked)} />
                Cross-area coordination gaps
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.challenges.external} onChange={(event) => updateChallenge('external', event.target.checked)} />
                External factors
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.challenges.other} onChange={(event) => updateChallenge('other', event.target.checked)} />
                Other
              </label>
            </div>
            {form.challenges.other && (
              <input
                type="text"
                value={form.challenges.otherText}
                onChange={(event) => updateChallenge('otherText', event.target.value)}
                className="mt-3 w-full px-3 py-2 border border-stone-200 rounded-lg"
                placeholder="Other challenges"
              />
            )}
            <textarea
              value={form.challenges.details}
              onChange={(event) => updateChallenge('details', event.target.value)}
              className="mt-3 w-full px-3 py-2 border border-stone-200 rounded-lg min-h-[100px]"
              placeholder="Details"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-steel">Support needed to stay on track</label>
            <textarea
              value={form.supportNeeded}
              onChange={(event) => updateField('supportNeeded', event.target.value)}
              className="w-full mt-2 px-3 py-2 border border-stone-200 rounded-lg min-h-[100px]"
              placeholder="Be specific about the help needed."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-steel">Areas that could assist</label>
              <input
                type="text"
                value={form.supportAreas}
                onChange={(event) => updateField('supportAreas', event.target.value)}
                className="w-full mt-2 px-3 py-2 border border-stone-200 rounded-lg"
                placeholder="Other focus areas"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-steel">Type of support needed</label>
              <div className="mt-2 space-y-2 text-sm text-stone-700">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.supportTypes.staff} onChange={(event) => updateSupportType('staff', event.target.checked)} />
                  Staff or volunteer help
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.supportTypes.marketing} onChange={(event) => updateSupportType('marketing', event.target.checked)} />
                  Marketing or communications
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.supportTypes.board} onChange={(event) => updateSupportType('board', event.target.checked)} />
                  Board guidance or decision
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.supportTypes.funding} onChange={(event) => updateSupportType('funding', event.target.checked)} />
                  Funding or fundraising support
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.supportTypes.facilities} onChange={(event) => updateSupportType('facilities', event.target.checked)} />
                  Facilities or logistics
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.supportTypes.other} onChange={(event) => updateSupportType('other', event.target.checked)} />
                  Other
                </label>
              </div>
              {form.supportTypes.other && (
                <input
                  type="text"
                  value={form.supportTypes.otherText}
                  onChange={(event) => updateSupportType('otherText', event.target.value)}
                  className="mt-3 w-full px-3 py-2 border border-stone-200 rounded-lg"
                  placeholder="Other support type"
                />
              )}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-steel">
              Areas this team can help
            </label>
            <textarea
              value={form.crossHelp}
              onChange={(event) => updateField('crossHelp', event.target.value)}
              className="w-full mt-2 px-3 py-2 border border-stone-200 rounded-lg min-h-[100px]"
              placeholder="Expertise, capacity, collaboration opportunities."
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-steel">Top 3 priorities for next quarter</label>
            <div className="mt-3 space-y-2">
              {form.nextPriorities.map((item, index) => (
                <input
                  key={index}
                  type="text"
                  value={item}
                  onChange={(event) => updatePriority(index, event.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg"
                  placeholder={`${index + 1}.`}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-steel">Decisions or approvals needed</label>
            <textarea
              value={form.decisionsNeeded}
              onChange={(event) => updateField('decisionsNeeded', event.target.value)}
              className="w-full mt-2 px-3 py-2 border border-stone-200 rounded-lg min-h-[100px]"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-steel">Strategic alignment</label>
            <textarea
              value={form.strategicAlignment}
              onChange={(event) => updateField('strategicAlignment', event.target.value)}
              className="w-full mt-2 px-3 py-2 border border-stone-200 rounded-lg min-h-[120px]"
              placeholder="How this work supports broader goals."
            />
          </div>

          <div className="border-t border-stone-200 pt-6">
            <h2 className="font-display text-2xl text-ink">Co-champion review</h2>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wide text-steel">Overall assessment</label>
                <select
                  value={form.review.assessment}
                  onChange={(event) => updateReview('assessment', event.target.value)}
                  className="w-full mt-2 px-3 py-2 border border-stone-200 rounded-lg bg-white"
                >
                  <option value="">Select</option>
                  {['On Track', 'Needs Attention', 'Major Adjustment Needed'].map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-steel">Review date</label>
                <input
                  type="date"
                  value={form.review.reviewDate}
                  onChange={(event) => updateReview('reviewDate', event.target.value)}
                  className="w-full mt-2 px-3 py-2 border border-stone-200 rounded-lg"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wide text-steel">Agreed-upon actions</label>
                <textarea
                  value={form.review.actions}
                  onChange={(event) => updateReview('actions', event.target.value)}
                  className="w-full mt-2 px-3 py-2 border border-stone-200 rounded-lg min-h-[100px]"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wide text-steel">Assigned follow-ups and owners</label>
                <textarea
                  value={form.review.followUps}
                  onChange={(event) => updateReview('followUps', event.target.value)}
                  className="w-full mt-2 px-3 py-2 border border-stone-200 rounded-lg min-h-[100px]"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-steel">Area lead signature</label>
                <input
                  type="text"
                  value={form.review.leadSignature}
                  onChange={(event) => updateReview('leadSignature', event.target.value)}
                  className="w-full mt-2 px-3 py-2 border border-stone-200 rounded-lg"
                  placeholder="Name"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-steel">Co-champion signature</label>
                <input
                  type="text"
                  value={form.review.championSignature}
                  onChange={(event) => updateReview('championSignature', event.target.value)}
                  className="w-full mt-2 px-3 py-2 border border-stone-200 rounded-lg"
                  placeholder="Name"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="px-6 py-3 bg-ocean text-white rounded-lg">
              Submit quarterly update
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// VIEWS
// ============================================================================

const DashboardView = ({ initiatives, metrics }) => {
  const [openQuarter, setOpenQuarter] = useState(null);
  const progressAvg = initiatives.length
    ? Math.round(initiatives.reduce((sum, item) => sum + (Number(item.progress) || 0), 0) / initiatives.length)
    : 0;

  const byFocusArea = FOCUS_AREAS.map((focusArea) => ({
    focusArea,
    count: initiatives.filter((item) => item.focusArea === focusArea).length
  }));

  const visionByFocusArea = FOCUS_AREAS.map((focusArea) => {
    const match = initiatives.find((item) => item.focusArea === focusArea && item.threeYearVision);
    return {
      focusArea,
      vision: match?.threeYearVision || 'Add a three-year vision for this focus area.'
    };
  });

  return (
    <div className="max-w-6xl mx-auto fade-up">
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="glass rounded-3xl p-6 md:p-8 card-shadow">
          <div className="flex items-center gap-3 text-ocean">
            <IconSpark size={28} />
            <span className="text-xs uppercase tracking-wide">Mission and vision</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl text-ink mt-4">
            Mission: To restore North Star House as a cultural gathering center, bringing the magic of the arts, theater, literature, history and music to generations of children, youth, and adults as well as providing a unique environment that nourishes the creative spirit.
          </h1>
          <p className="text-stone-600 mt-3">
            Vision: [Add your vision statement here]
          </p>
          <div className="mt-6">
            <div className="flex items-center justify-between text-xs text-steel mb-2">
              <span>Overall progress</span>
              <span>{progressAvg}%</span>
            </div>
            <ProgressBar value={progressAvg} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Volunteers', value: formatCount(metrics?.volunteersCount) },
            { label: 'Events booked', value: formatCount(metrics?.eventsCount) },
            { label: 'Donation total', value: formatCurrency(metrics?.donationsTotal) },
            { label: 'Sponsors', value: formatCount(metrics?.sponsorsCount) }
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-2xl p-5 border border-stone-100 card-shadow">
              <div className="text-xs uppercase tracking-wide text-steel">{item.label}</div>
              <div className="font-display text-3xl text-ink mt-3">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {byFocusArea.map((item) => (
          <div key={item.focusArea} className="bg-white rounded-2xl p-4 border border-stone-100 card-shadow">
            <div className="text-xs uppercase tracking-wide text-steel">{item.focusArea}</div>
            <div className="font-display text-2xl mt-2">{item.count}</div>
            <div className="text-xs text-stone-500">Initiatives tracked</div>
          </div>
        ))}
      </div>
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-ink">Three-year vision</h2>
          <span className="text-xs uppercase tracking-wide text-steel">By focus area</span>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {visionByFocusArea.map((item) => (
            <div key={item.focusArea} className="bg-white rounded-2xl p-5 border border-stone-100 card-shadow">
              <div className="text-xs uppercase tracking-wide text-steel">{item.focusArea}</div>
              <p className="text-sm text-stone-700 mt-2">{item.vision}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-ink">Quarterly focus</h2>
          <span className="text-xs uppercase tracking-wide text-steel">Tap to expand</span>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {['Q1', 'Q2', 'Q3', 'Q4'].map((quarter) => {
            const isOpen = openQuarter === quarter;
            return (
              <div key={quarter} className="bg-white rounded-2xl border border-stone-100 card-shadow">
                <button
                  type="button"
                  onClick={() => setOpenQuarter(isOpen ? null : quarter)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <div>
                    <div className="text-xs uppercase tracking-wide text-steel">Quarter</div>
                    <div className="font-display text-xl text-ink">{quarter}</div>
                  </div>
                  <span className="text-sm text-ocean">{isOpen ? 'Close' : 'Open'}</span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-sm text-stone-700">
                    Add quarterly priorities, milestones, and key outcomes here.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const InitiativesView = ({ initiatives, onSelect, onAdd, onRefresh, isLoading }) => {
  const [search, setSearch] = useState('');
  const [focusArea, setFocusArea] = useState('');
  const [status, setStatus] = useState('');

  const filtered = useMemo(() => {
    return initiatives.filter((item) => {
      const text = [item.title, item.description, item.owner, item.coChampions, item.focusArea, item.status]
        .join(' ')
        .toLowerCase();
      if (search && !text.includes(search.toLowerCase())) return false;
      if (focusArea && item.focusArea !== focusArea) return false;
      if (status && item.status !== status) return false;
      return true;
    });
  }, [initiatives, search, focusArea, status]);

  return (
    <div className="max-w-6xl mx-auto fade-up">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display text-3xl text-ink">Strategic initiatives</h2>
          <p className="text-stone-600">Browse progress, submit updates, and review action items.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="px-4 py-2 border border-stone-200 rounded-lg text-sm"
            disabled={isLoading}
          >
            <span className="inline-flex items-center gap-2">
              <IconRefresh size={16} /> Refresh
            </span>
          </button>
          <button onClick={onAdd} className="px-4 py-2 bg-clay text-white rounded-lg text-sm">
            <span className="inline-flex items-center gap-2">
              <IconPlus size={16} /> Add initiative
            </span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 p-4 card-shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search initiatives"
            className="px-3 py-2 border border-stone-200 rounded-lg"
          />
          <select
            value={focusArea}
            onChange={(event) => setFocusArea(event.target.value)}
            className="px-3 py-2 border border-stone-200 rounded-lg bg-white"
          >
            <option value="">All focus areas</option>
            {FOCUS_AREAS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="px-3 py-2 border border-stone-200 rounded-lg bg-white"
          >
            <option value="">All statuses</option>
            {STATUSES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-100 p-8 text-center text-stone-600">
          No initiatives found. Adjust filters or add a new initiative.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((initiative) => (
            <InitiativeCard
              key={initiative.id}
              initiative={initiative}
              onSelect={() => onSelect(initiative.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const InitiativeDetailView = ({ initiative, onBack, onEdit, onSubmitUpdate, onReviewUpdate }) => {
  const updates = sortUpdates(initiative.updates || []);

  return (
    <div className="max-w-5xl mx-auto fade-up">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-ocean mb-4">
        <IconBack size={18} /> Back to initiatives
      </button>

      <div className="bg-white rounded-3xl border border-stone-100 p-6 md:p-8 card-shadow">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-steel">{initiative.focusArea}</div>
            <h1 className="font-display text-3xl text-ink mt-2">{initiative.title}</h1>
            <p className="text-stone-600 mt-2">{initiative.description}</p>
          </div>
          <div className="flex flex-col items-start gap-3">
            <StatusPill status={initiative.status} />
            <button onClick={onEdit} className="px-4 py-2 border border-stone-200 rounded-lg text-sm">
              Edit initiative
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div>
            <div className="text-xs uppercase tracking-wide text-steel">Goal lead</div>
            <div className="text-sm text-ink mt-1">{initiative.owner || 'Unassigned'}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-steel">Co-champions</div>
            <div className="text-sm text-ink mt-1">{initiative.coChampions || 'Not listed'}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-steel">Target date</div>
            <div className="text-sm text-ink mt-1">{initiative.targetDate || 'TBD'}</div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between text-xs text-steel mb-2">
            <span>Progress</span>
            <span>{Math.round(initiative.progress)}%</span>
          </div>
          <ProgressBar value={initiative.progress} />
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-steel">Success metrics</div>
            <div className="text-sm text-ink mt-1">{initiative.successMetrics || 'Not defined'}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-steel">Notes</div>
            <div className="text-sm text-ink mt-1">{initiative.notes || 'No notes yet'}</div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-steel">Three-year vision for success</div>
            <div className="text-sm text-ink mt-1">{initiative.threeYearVision || 'Not defined'}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-steel">Annual goals</div>
            <div className="text-sm text-ink mt-1">{initiative.annualGoals || 'Not defined'}</div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <UpdateForm initiative={initiative} onSubmit={(update) => onSubmitUpdate(initiative, update)} />
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl">Update log</h2>
          <span className="text-xs text-steel">{updates.length} updates</span>
        </div>
        {updates.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-100 p-6 text-stone-600">
            No updates yet. Submit the first update to start the log.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {updates.map((update) => (
              <UpdateCard
                key={update.id}
                update={update}
                onReviewSave={(updateId, status, notes) => onReviewUpdate(initiative, updateId, status, notes)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN APP
// ============================================================================

const StrategyApp = () => {
  const [initiatives, setInitiatives] = useState([]);
  const [view, setView] = useState('dashboard');
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState({
    donationsTotal: null,
    volunteersCount: null,
    eventsCount: null,
    sponsorsCount: null
  });

  const selectedInitiative = useMemo(
    () => initiatives.find((item) => item.id === selectedId) || null,
    [initiatives, selectedId]
  );

  const editingInitiative = useMemo(
    () => initiatives.find((item) => item.id === editingId) || null,
    [initiatives, editingId]
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async ({ useCache = true } = {}) => {
    if (!USE_SHEETS) {
      const cached = readCache();
      setInitiatives((cached?.objects || []).map(normalizeInitiative));
      setIsConnected(false);
      setIsLoading(false);
      return;
    }

    const cached = useCache ? readCache() : null;
    const isCacheFresh = cached && (Date.now() - cached.updatedAt) < CACHE_TTL_MS;

    if (cached?.objects?.length) {
      setInitiatives(cached.objects.map(normalizeInitiative));
      setIsConnected(SheetsAPI.isConfigured());
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    try {
      if (isCacheFresh) {
        // Still refresh in the background for latest changes.
      }
      const data = await SheetsAPI.fetchAll();
      const normalized = (data || []).map(normalizeInitiative);
      setInitiatives(normalized);
      setIsConnected(SheetsAPI.isConfigured());
      writeCache(normalized);
    } catch (error) {
      console.error('Failed to load data:', error);
      if (!cached?.objects?.length) {
        setInitiatives(SAMPLE_INITIATIVES.map(normalizeInitiative));
      }
    }

    setIsLoading(false);
    const metricsData = await SheetsAPI.fetchMetrics();
    if (metricsData) {
      setMetrics(metricsData);
    }
  };

  const handleSelect = (id) => {
    setSelectedId(id);
    setView('detail');
    window.scrollTo(0, 0);
  };

  const handleAdd = () => {
    setEditingId(null);
    setView('add');
    window.scrollTo(0, 0);
  };

  const handleEdit = (initiative) => {
    setEditingId(initiative.id);
    setView('edit');
    window.scrollTo(0, 0);
  };

  const handleSaveInitiative = async (initiative) => {
    setIsSaving(true);
    try {
      if (editingInitiative) {
        const updated = await SheetsAPI.update({ ...initiative, updates: initiative.updates || [] });
        setInitiatives((prev) => {
          const next = prev.map((item) => (item.id === updated.id ? normalizeInitiative(updated) : item));
          writeCache(next);
          return next;
        });
        setSelectedId(updated.id);
        setView('detail');
      } else {
        const created = await SheetsAPI.create({
          ...initiative,
          id: initiative.id || makeId(),
          updates: initiative.updates || []
        });
        setInitiatives((prev) => {
          const next = [...prev, normalizeInitiative(created)];
          writeCache(next);
          return next;
        });
        setSelectedId(created.id);
        setView('detail');
      }
    } catch (error) {
      console.error('Failed to save initiative:', error);
      alert('Failed to save. Please try again.');
    }
    setIsSaving(false);
  };

  const handleSubmitUpdate = async (initiative, update) => {
    const updates = [update, ...(initiative.updates || [])];
    const next = {
      ...initiative,
      updates,
      progress: update.progress,
      lastUpdateAt: update.date
    };
    try {
      await SheetsAPI.update(next);
      setInitiatives((prev) => {
        const updated = prev.map((item) => (item.id === initiative.id ? normalizeInitiative(next) : item));
        writeCache(updated);
        return updated;
      });
    } catch (error) {
      console.error('Failed to submit update:', error);
      alert('Failed to submit update. Please try again.');
    }
  };

  const handleReviewUpdate = async (initiative, updateId, status, notes) => {
    const updates = (initiative.updates || []).map((item) =>
      item.id === updateId ? { ...item, reviewStatus: status, reviewNotes: notes } : item
    );
    const next = { ...initiative, updates };
    try {
      await SheetsAPI.update(next);
      setInitiatives((prev) => {
        const updated = prev.map((item) => (item.id === initiative.id ? normalizeInitiative(next) : item));
        writeCache(updated);
        return updated;
      });
    } catch (error) {
      console.error('Failed to save review:', error);
      alert('Failed to save review. Please try again.');
    }
  };

  const isDetailReady = view === 'detail' && selectedInitiative;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-stone-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gold text-white flex items-center justify-center shadow-sm">
                <IconStar size={18} />
              </div>
              <div>
                <div className="font-display text-lg text-ink">North Star Strategic Plan</div>
                <div className="text-xs text-steel">Board progress tracker</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => { setView('dashboard'); setSelectedId(null); }}
                className={`px-3 py-2 rounded-lg ${view === 'dashboard' ? 'bg-stone-100' : ''}`}
              >
                Dashboard
              </button>
              <button
                onClick={() => { setView('list'); setSelectedId(null); }}
                className={`px-3 py-2 rounded-lg ${view === 'list' ? 'bg-stone-100' : ''}`}
              >
                Initiatives
              </button>
              <button
                onClick={() => { setView('quarterly'); setSelectedId(null); }}
                className={`px-3 py-2 rounded-lg ${view === 'quarterly' ? 'bg-stone-100' : ''}`}
              >
                Quarterly Form
              </button>
              <span className={`text-xs ${isConnected ? 'text-emerald-600' : 'text-steel'}`}>
                {isConnected ? 'Synced' : 'Local'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-stone-100 p-8 text-center text-stone-600">
            Loading strategic plan data...
          </div>
        ) : (
          <>
            {view === 'dashboard' && <DashboardView initiatives={initiatives} metrics={metrics} />}
            {view === 'quarterly' && <QuarterlyUpdateForm />}
            {view === 'list' && (
              <InitiativesView
                initiatives={initiatives}
                onSelect={handleSelect}
                onAdd={handleAdd}
                onRefresh={() => loadData({ useCache: false })}
                isLoading={isLoading}
              />
            )}
            {isDetailReady && (
              <InitiativeDetailView
                initiative={selectedInitiative}
                onBack={() => setView('list')}
                onEdit={() => handleEdit(selectedInitiative)}
                onSubmitUpdate={handleSubmitUpdate}
                onReviewUpdate={handleReviewUpdate}
              />
            )}
            {(view === 'add' || view === 'edit') && (
              <div className="max-w-4xl mx-auto fade-up">
                <button
                  onClick={() => setView(editingInitiative ? 'detail' : 'list')}
                  className="flex items-center gap-2 text-sm text-ocean mb-4"
                >
                  <IconBack size={18} /> Cancel
                </button>
                <InitiativeForm
                  initiative={editingInitiative}
                  onSave={handleSaveInitiative}
                  onCancel={() => setView(editingInitiative ? 'detail' : 'list')}
                  isSaving={isSaving}
                />
              </div>
            )}
          </>
        )}
      </main>

      <footer className="mt-12 pb-10 text-center text-xs text-steel">
        Built for shared accountability and board-level clarity.
      </footer>
    </div>
  );
};

// ============================================================================
// RENDER
// ============================================================================

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<StrategyApp />);

