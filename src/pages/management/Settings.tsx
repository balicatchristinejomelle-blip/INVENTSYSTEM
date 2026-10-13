import React, { useState } from 'react';
import { useApp } from '../../store';

const TABS = ['Storage & Locations', 'Notifications', 'Display'] as const;
type Tab = typeof TABS[number];

interface StorageSection {
  id: string;
  name: string;
  prefix: string;
  capacity: number;
  notes: string;
}

const INITIAL_SECTIONS: StorageSection[] = [
  { id: 's1', name: 'Section A', prefix: 'A', capacity: 500, notes: 'General pipe storage — 75mm and 63mm diameters' },
  { id: 's2', name: 'Section B', prefix: 'B', capacity: 500, notes: 'Large diameter pipe storage — 110mm and above' },
  { id: 's3', name: 'Section C', prefix: 'C', capacity: 300, notes: 'Pellet and raw material staging area' },
];

const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
    {children}
  </h3>
);

const FixedRulesBox = () => (
  <div style={{
    marginTop: 20,
    padding: '14px 16px',
    background: 'var(--input-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 8,
    opacity: 0.85,
  }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
      Fixed Business Rules — Read Only
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--app-bg)', borderRadius: 6, border: '1px solid var(--card-border)' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Rejected Material Limit:</span>
          <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginLeft: 6 }}>50 kg</span>
          <span className="badge-red" style={{ marginLeft: 8, fontSize: 10 }}>FIXED</span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Set by company policy</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--app-bg)', borderRadius: 6, border: '1px solid var(--card-border)' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Recycling Trigger:</span>
          <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginLeft: 6 }}>40 kg</span>
          <span className="badge-red" style={{ marginLeft: 8, fontSize: 10 }}>FIXED</span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Set by company policy</span>
      </div>
    </div>
    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.6 }}>
      These thresholds are governed by company safety and quality policy and cannot be changed through the system. Contact company administration to request a policy review.
    </p>
  </div>
);

export default function Settings() {
  useApp();

  const [activeTab, setActiveTab] = useState<Tab>('Storage & Locations');

  // ── Storage & Locations state ──────────────────────────────────────────────
  const [sections, setSections] = useState<StorageSection[]>(INITIAL_SECTIONS);
  const [storageSaved, setStorageSaved] = useState(false);

  const updateSection = (id: string, field: keyof StorageSection, value: string | number) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    setStorageSaved(false);
  };

  const addSection = () => {
    const newId = `s${Date.now()}`;
    setSections(prev => [...prev, { id: newId, name: '', prefix: '', capacity: 0, notes: '' }]);
    setStorageSaved(false);
  };

  const removeSection = (id: string) => {
    setSections(prev => prev.filter(s => s.id !== id));
    setStorageSaved(false);
  };

  const saveStorageChanges = () => {
    setStorageSaved(true);
    setTimeout(() => setStorageSaved(false), 3000);
  };

  // ── Notifications state ────────────────────────────────────────────────────
  const [lowPelletEnabled, setLowPelletEnabled] = useState(true);
  const [lowPelletThreshold, setLowPelletThreshold] = useState(100);
  const [turnoverReminderEnabled, setTurnoverReminderEnabled] = useState(true);
  const [behindScheduleEnabled, setBehindScheduleEnabled] = useState(true);
  const [behindScheduleThreshold, setBehindScheduleThreshold] = useState(80);
  const [fgReadyEnabled, setFgReadyEnabled] = useState(true);
  const [notifSaved, setNotifSaved] = useState(false);

  const saveNotifications = () => {
    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 3000);
  };

  // ── Display state ──────────────────────────────────────────────────────────
  const [dateFormat, setDateFormat] = useState<'MM/DD/YYYY' | 'YYYY-MM-DD'>('YYYY-MM-DD');
  const [timeFormat, setTimeFormat] = useState<'12' | '24'>('24');
  const [defaultPage, setDefaultPage] = useState('Dashboard');
  const [itemsPerPage, setItemsPerPage] = useState('25');
  const [displaySaved, setDisplaySaved] = useState(false);

  const saveDisplay = () => {
    setDisplaySaved(true);
    setTimeout(() => setDisplaySaved(false), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Settings</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Branch Plant Management Configuration</p>
      </div>

      {/* Tabs */}
      <div className="report-tabs" style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--card-border)', paddingBottom: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '7px 14px',
              fontSize: 12,
              fontWeight: activeTab === tab ? 700 : 500,
              color: activeTab === tab ? 'var(--accent-gold)' : 'var(--text-muted)',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--accent-gold)' : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: -1,
              transition: 'color 0.15s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── STORAGE & LOCATIONS ─────────────────────────────────────────────── */}
      {activeTab === 'Storage & Locations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="app-card" style={{ padding: 14 }}>
            <SectionHeader>Storage Sections</SectionHeader>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              Define and manage storage section names, prefixes, and capacity for finished goods and pellet inventory.
            </p>

            {/* Editable sections table */}
            <div className="table-scroll" style={{ overflowX: 'auto' }}>
              <table className="app-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: 160 }}>Section Name</th>
                    <th style={{ width: 90 }}>Prefix</th>
                    <th style={{ width: 130 }}>Capacity (pcs)</th>
                    <th>Notes</th>
                    <th style={{ width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map(section => (
                    <tr key={section.id} className="table-row-hover">
                      <td>
                        <input
                          className="app-input"
                          style={{ width: '100%', padding: '4px 8px', fontSize: 12 }}
                          value={section.name}
                          onChange={e => updateSection(section.id, 'name', e.target.value)}
                          placeholder="Section name"
                        />
                      </td>
                      <td>
                        <input
                          className="app-input"
                          style={{ width: '100%', padding: '4px 8px', fontSize: 12 }}
                          value={section.prefix}
                          onChange={e => updateSection(section.id, 'prefix', e.target.value)}
                          placeholder="A"
                          maxLength={4}
                        />
                      </td>
                      <td>
                        <input
                          className="app-input"
                          style={{ width: '100%', padding: '4px 8px', fontSize: 12 }}
                          type="number"
                          value={section.capacity}
                          onChange={e => updateSection(section.id, 'capacity', parseInt(e.target.value) || 0)}
                          min={0}
                        />
                      </td>
                      <td>
                        <input
                          className="app-input"
                          style={{ width: '100%', padding: '4px 8px', fontSize: 12 }}
                          value={section.notes}
                          onChange={e => updateSection(section.id, 'notes', e.target.value)}
                          placeholder="Optional notes"
                        />
                      </td>
                      <td>
                        <button
                          onClick={() => removeSection(section.id)}
                           className="btn-danger btn-compact"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 12 }} className="form-actions">
              <button className="btn-primary" onClick={addSection}>
                Add Section</button>
              <button className="btn-primary" onClick={saveStorageChanges}>
                Save Changes
              </button>
              {storageSaved && (
                <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                  Changes saved successfully.
                </span>
              )}
            </div>
          </div>

          {/* Fixed Business Rules */}
          <div className="app-card" style={{ padding: 14 }}>
            <FixedRulesBox />
          </div>
        </div>
      )}

      {/* ── NOTIFICATIONS ───────────────────────────────────────────────────── */}
      {activeTab === 'Notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="app-card" style={{ padding: 16 }}>
            <SectionHeader>Notification Preferences</SectionHeader>

            {/* Low pellet stock */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: '12px 14px', border: '1px solid var(--card-border)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Low Pellet Stock Alerts</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Receive an alert when any pellet batch falls below the threshold.</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Threshold:</span>
                    <input
                      className="app-input"
                      type="number"
                      value={lowPelletThreshold}
                      onChange={e => setLowPelletThreshold(parseInt(e.target.value) || 0)}
                      style={{ width: 70, padding: '4px 8px', fontSize: 12 }}
                      disabled={!lowPelletEnabled}
                      min={0}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>kg</span>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={lowPelletEnabled}
                      onChange={e => setLowPelletEnabled(e.target.checked)}
                      style={{ width: 15, height: 15, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Enabled</span>
                  </label>
                </div>
              </div>

              {/* Shift turnover reminders */}
              <div style={{ padding: '12px 14px', border: '1px solid var(--card-border)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Shift Turnover Reminders</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Notify management when a shift turnover is submitted and pending review.</div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={turnoverReminderEnabled}
                    onChange={e => setTurnoverReminderEnabled(e.target.checked)}
                    style={{ width: 15, height: 15, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Enabled</span>
                </label>
              </div>

              {/* Production behind schedule */}
              <div style={{ padding: '12px 14px', border: '1px solid var(--card-border)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Production Behind Schedule Alerts</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Alert when a production order completion rate falls below the threshold.</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Below:</span>
                    <input
                      className="app-input"
                      type="number"
                      value={behindScheduleThreshold}
                      onChange={e => setBehindScheduleThreshold(parseInt(e.target.value) || 0)}
                      style={{ width: 60, padding: '4px 8px', fontSize: 12 }}
                      disabled={!behindScheduleEnabled}
                      min={0}
                      max={100}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>%</span>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={behindScheduleEnabled}
                      onChange={e => setBehindScheduleEnabled(e.target.checked)}
                      style={{ width: 15, height: 15, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Enabled</span>
                  </label>
                </div>
              </div>

              {/* Finished goods ready */}
              <div style={{ padding: '12px 14px', border: '1px solid var(--card-border)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Finished Goods Ready for Release</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Notify when a production order completes and finished goods are available.</div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={fgReadyEnabled}
                    onChange={e => setFgReadyEnabled(e.target.checked)}
                    style={{ width: 15, height: 15, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Enabled</span>
                </label>
              </div>

              {/* Fixed rejected material note */}
              <div style={{
                padding: '10px 14px',
                border: '1px solid var(--card-border)',
                borderRadius: 6,
                background: 'var(--input-bg)',
                opacity: 0.8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 2 }}>
                      Rejected Material Threshold Alerts
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Automatic alerts at 40 kg (recycling trigger) and 50 kg (limit). These alerts are mandatory and cannot be disabled.
                    </div>
                  </div>
                  <span className="badge-red" style={{ fontSize: 10, marginLeft: 12 }}>FIXED</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16 }} className="form-actions">
              <button className="btn-primary" onClick={saveNotifications}>
                Save Preferences
              </button>
              {notifSaved && (
                <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                  Notification preferences saved.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── DISPLAY ──────────────────────────────────────────────────────────── */}
      {activeTab === 'Display' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="app-card" style={{ padding: 16 }}>
            <SectionHeader>Display Preferences</SectionHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Date format */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Date Format</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(['MM/DD/YYYY', 'YYYY-MM-DD'] as const).map(fmt => (
                    <label key={fmt} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="dateFormat"
                        value={fmt}
                        checked={dateFormat === fmt}
                        onChange={() => setDateFormat(fmt)}
                        style={{ width: 14, height: 14, cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>{fmt}</span>
                      {fmt === 'YYYY-MM-DD' && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'sans-serif' }}>(ISO — system default)</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--card-border)' }} />

              {/* Time format */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Time Format</div>
                <div style={{ display: 'flex', gap: 20 }}>
                  {([{ val: '24', label: '24-hour (14:30)' }, { val: '12', label: '12-hour (2:30 PM)' }] as const).map(opt => (
                    <label key={opt.val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="timeFormat"
                        value={opt.val}
                        checked={timeFormat === opt.val}
                        onChange={() => setTimeFormat(opt.val as '12' | '24')}
                        style={{ width: 14, height: 14, cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--card-border)' }} />

              {/* Default page on login */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Default Page on Login</div>
                <select
                  className="app-select"
                  value={defaultPage}
                  onChange={e => setDefaultPage(e.target.value)}
                  style={{ minWidth: 200, fontSize: 12, padding: '6px 10px' }}
                >
                  <option value="Dashboard">Dashboard</option>
                  <option value="Operations">Operations</option>
                  <option value="Reports">Reports</option>
                </select>
              </div>

              <div style={{ borderTop: '1px solid var(--card-border)' }} />

              {/* Items per page */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Items Per Page (Tables)</div>
                <select
                  className="app-select"
                  value={itemsPerPage}
                  onChange={e => setItemsPerPage(e.target.value)}
                  style={{ minWidth: 120, fontSize: 12, padding: '6px 10px' }}
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 20 }} className="form-actions">
              <button className="btn-primary" onClick={saveDisplay}>
                Save Preferences
              </button>
              {displaySaved && (
                <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                  Display preferences saved.
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
