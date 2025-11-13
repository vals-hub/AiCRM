'use client';

import { useMemo, useState } from 'react';

const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function formatDateTime(dateString, options = {}) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  });
}

function getUpcomingWeekday(baseDate, weekday) {
  const targetIndex = weekdays.indexOf(weekday);
  if (targetIndex === -1) return null;
  const date = new Date(baseDate);
  const baseIndex = date.getDay();
  let diff = targetIndex - baseIndex;
  if (diff <= 0) {
    diff += 7;
  }
  date.setDate(date.getDate() + diff);
  return date;
}

function interpretFollowUp(text) {
  if (!text) return null;
  const now = new Date();
  let date = null;
  const lower = text.toLowerCase();

  if (lower.includes('tomorrow')) {
    date = new Date(now);
    date.setDate(date.getDate() + 1);
  } else {
    const weekdayMatch = weekdays.find((day) => lower.includes(`next ${day}`) || lower.includes(day));
    if (weekdayMatch) {
      date = getUpcomingWeekday(now, weekdayMatch);
      if (lower.includes('next ' + weekdayMatch)) {
        date.setDate(date.getDate() + 7);
      }
    }
  }

  const isoDateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  const slashDateMatch = text.match(/(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/);

  if (!date && isoDateMatch) {
    date = new Date(isoDateMatch[1]);
  } else if (!date && slashDateMatch) {
    date = new Date(slashDateMatch[1]);
  }

  if (!date || Number.isNaN(date.getTime())) {
    date = new Date(now);
    date.setDate(date.getDate() + 3);
  }

  const timeMatch = text.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const meridiem = timeMatch[3];
    if (meridiem) {
      if (meridiem.toLowerCase() === 'pm' && hours < 12) {
        hours += 12;
      }
      if (meridiem.toLowerCase() === 'am' && hours === 12) {
        hours = 0;
      }
    }
    date.setHours(hours, minutes, 0, 0);
  }

  return date;
}

function parseNote(note) {
  const nameMatch = note.match(/(?:talked|spoke|met|called)\s+(?:with|to)\s+([^,.;\n]+)/i);
  const emailMatch = note.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = note.match(/(\+?\d[\d\s().-]{7,}\d)/);
  const companyMatch = note.match(/(?:at|from|for|with)\s+([A-Z][A-Za-z0-9&'\-\s]+)(?=\.|,|\s)/);
  const followUpMatch = note.match(/follow(?:\s|-)?up[^,.;\n]*?\s(?:on|with|by)?\s*([^.;\n]+)/i);
  const nextActionMatch = note.match(/(?:need|plan|should|will|schedule)\s+to\s+([^.;\n]+)/i);

  const followUpText = followUpMatch ? followUpMatch[1].trim() : '';
  const followUpDate = interpretFollowUp(followUpText);

  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id,
    name: nameMatch ? nameMatch[1].trim() : 'Prospect',
    email: emailMatch ? emailMatch[0] : '—',
    phone: phoneMatch ? phoneMatch[0].trim() : '—',
    company: companyMatch ? companyMatch[1].trim() : 'Independent',
    lastContact: new Date().toISOString(),
    nextAction: nextActionMatch ? nextActionMatch[1].trim() : followUpText ? `Follow up ${followUpText}` : 'Review conversation',
    followUpDate: followUpDate ? followUpDate.toISOString() : null,
    notes: note.trim()
  };
}

const emptyStateExamples = [
  'Met Jamie at the fintech summit, she leads partnerships at NovaPay. Send product deck tomorrow afternoon.',
  'Quick chat with Priya from HorizonAI (priya@horizon.ai). Wants pricing sheet, follow up next Wednesday 10:00.',
  'Checked in with Carlos - CTO at VerdeGrid. Needs integration timeline. Call him Friday 2pm at +1 555 234 7788.'
];

export default function Home() {
  const [notes, setNotes] = useState('I talked with Sarah Connor, her email is sarah@example.com, phone +44 7911 123456. Follow up next Tuesday at 15:00, she works at Skynet.');
  const [contacts, setContacts] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessed, setLastProcessed] = useState(null);

  const heroSubtitle = useMemo(() => {
    if (!contacts.length) return 'Let investors experience how natural language turns into pipeline clarity instantly.';
    return `You have captured ${contacts.length} relationship${contacts.length > 1 ? 's' : ''} effortlessly.`;
  }, [contacts.length]);

  const metrics = useMemo(() => {
    if (!contacts.length) return null;

    const upcoming = contacts
      .filter((contact) => contact.followUpDate)
      .map((contact) => ({
        ...contact,
        followUpDateObj: new Date(contact.followUpDate)
      }))
      .filter((contact) => !Number.isNaN(contact.followUpDateObj.getTime()))
      .sort((a, b) => a.followUpDateObj - b.followUpDateObj);

    const upcomingWithinWeek = upcoming.filter((contact) => {
      const diff = contact.followUpDateObj.getTime() - Date.now();
      const days = diff / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 7;
    });

    const uniqueCompanies = new Set(
      contacts
        .map((contact) => contact.company)
        .filter(Boolean)
    );

    return {
      totalContacts: contacts.length,
      uniqueCompanies: uniqueCompanies.size,
      upcomingWithinWeek: upcomingWithinWeek.length,
      nextFollowUp: upcoming[0] ?? null
    };
  }, [contacts]);

  const handleProcess = () => {
    if (!notes.trim()) return;
    setIsProcessing(true);
    setTimeout(() => {
      const parsed = parseNote(notes);
      setContacts((prev) => [parsed, ...prev]);
      setLastProcessed(parsed.name);
      setIsProcessing(false);
      setNotes('');
    }, 900);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      <div className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.35),transparent_60%)] blur-3xl" />
        <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-12 px-6 pt-20 lg:px-12">
          <header className="space-y-6 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-4 py-1 text-sm font-medium uppercase tracking-wide text-slate-300">
              <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_12px_rgba(34,211,238,0.8)]" />AI-First CRM
            </span>
            <h1 className="text-4xl font-semibold leading-tight text-slate-50 sm:text-5xl lg:text-6xl">
              Transform raw conversations into investor-ready intelligence.
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-slate-300">{heroSubtitle}</p>
          </header>

          <section className="grid gap-8 rounded-3xl border border-slate-800/60 bg-slate-900/60 p-8 shadow-[0_40px_120px_-40px_rgba(15,23,42,0.8)] backdrop-blur-lg lg:grid-cols-2 lg:gap-10">
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-100">Conversation capture</h2>
                  <p className="text-sm text-slate-400">Drop any unstructured update. We will do the rest.</p>
                </div>
                {lastProcessed && (
                  <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-4 py-1 text-xs text-slate-300">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                    Added {lastProcessed}
                  </div>
                )}
              </div>

              <div className="relative flex-1">
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="I met Jamie at the conference..."
                  className="min-h-[320px] w-full resize-none rounded-2xl border border-slate-800 bg-slate-950/80 px-5 py-4 text-lg leading-relaxed text-slate-100 shadow-inner outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/5" />
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-400">
                  We simulate AI extraction on-device. Swap the prompt above to test different scenarios.
                </p>
                <button
                  type="button"
                  onClick={handleProcess}
                  disabled={isProcessing || !notes.trim()}
                  className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-primary px-6 py-3 text-sm font-semibold tracking-wide text-white shadow-lg shadow-primary/40 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:bg-slate-700"
                >
                  <span className="absolute inset-0 -translate-y-full bg-gradient-to-r from-accent/80 via-white/40 to-accent/80 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100" />
                  <span className="relative flex items-center gap-2">
                    {isProcessing ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-80" d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 12h14" strokeLinecap="round" />
                          <path d="M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Process with AI (demo)
                      </>
                    )}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-100">Pipeline intelligence</h2>
                  <p className="text-sm text-slate-400">Structured insights appear instantly for the team.</p>
                </div>
                <div className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300">
                  {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>

              {metrics && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent p-4 shadow-lg shadow-primary/10">
                    <p className="text-xs uppercase tracking-wide text-primary/80">Active relationships</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-100">{metrics.totalContacts}</p>
                    <p className="mt-1 text-xs text-slate-400">Captured from natural language notes</p>
                  </div>
                  <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/20 via-accent/5 to-transparent p-4 shadow-lg shadow-accent/10">
                    <p className="text-xs uppercase tracking-wide text-accent/80">Next 7 days</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-100">{metrics.upcomingWithinWeek}</p>
                    <p className="mt-1 text-xs text-slate-400">Follow-ups scheduled this week</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 shadow-inner">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Next follow-up</p>
                    <p className="mt-2 text-lg font-semibold text-slate-100">
                      {metrics.nextFollowUp ? metrics.nextFollowUp.name : 'Awaiting contact'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {metrics.nextFollowUp ? `${metrics.nextFollowUp.company} • ${formatDateTime(metrics.nextFollowUp.followUpDate)}` : 'Log a note to populate your pipeline.'}
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-800/60 bg-slate-950/60 p-4 shadow-inner">
                {contacts.length === 0 ? (
                  <div className="flex h-[320px] flex-col items-center justify-center gap-4 text-center text-slate-400">
                    <svg className="h-12 w-12 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4Z" />
                      <path d="M6.8 20a5.2 5.2 0 0 1 10.4 0" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="space-y-2">
                      <p className="text-lg font-medium text-slate-200">Your board-ready CRM awaits.</p>
                      <p>Try one of these notes to see the magic:</p>
                      <ul className="space-y-1 text-sm text-slate-400">
                        {emptyStateExamples.map((example) => (
                          <li key={example} className="rounded-md bg-slate-900/80 px-3 py-2 font-mono text-xs text-slate-300">
                            {example}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[360px] overflow-y-auto pr-2">
                    <table className="min-w-full table-fixed divide-y divide-slate-800 text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-950/95 text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="w-40 px-3 py-3 text-left">Contact</th>
                          <th className="w-48 px-3 py-3 text-left">Company</th>
                          <th className="w-48 px-3 py-3 text-left">Email</th>
                          <th className="w-36 px-3 py-3 text-left">Phone</th>
                          <th className="w-36 px-3 py-3 text-left">Last touch</th>
                          <th className="w-40 px-3 py-3 text-left">Next action</th>
                          <th className="w-48 px-3 py-3 text-left">Follow-up</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 text-slate-200">
                        {contacts.map((contact) => (
                          <tr
                            key={contact.id}
                            className="transition hover:bg-primary/5"
                          >
                            <td className="px-3 py-4">
                              <div className="font-semibold text-slate-100">{contact.name}</div>
                              <div className="text-xs text-slate-400">{contact.notes.slice(0, 70)}{contact.notes.length > 70 ? '…' : ''}</div>
                            </td>
                            <td className="px-3 py-4 text-slate-300">{contact.company}</td>
                            <td className="px-3 py-4 text-slate-300">{contact.email}</td>
                            <td className="px-3 py-4 text-slate-300">{contact.phone}</td>
                            <td className="px-3 py-4 text-slate-300">{formatDateTime(contact.lastContact)}</td>
                            <td className="px-3 py-4">
                              <span className="inline-flex rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary">
                                {contact.nextAction}
                              </span>
                            </td>
                            <td className="px-3 py-4 text-slate-300">{formatDateTime(contact.followUpDate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
