/**
 * Mail tool (local unit case).
 * Real Gmail OAuth is gated. Inbox + drafts prove the canvas UX.
 * Dates are relative to "today" so the desk always feels live.
 */

import { COURSES } from './classify.js';
import { semesterFromDate } from './semester.js';

function isoOffset(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Fresh school inbox every load: relative to today. */
export function buildSampleInbox(now = new Date()) {
  void now;
  return [
    {
      id: 'mail_chem_lab',
      from: 'Ms. Patel <patel@lincoln.edu>',
      to: 'maya@student.edu',
      subject: 'Lab report due Friday · stoichiometry',
      preview: 'Attach your limiting reactant write-up. Rubric is on Moodle.',
      body: 'Maya,\n\nLab report for Unit 3 is due Friday. Attach your limiting reactant write-up and the data table. Rubric is on Moodle.\n\nMs. Patel\nAP Chemistry',
      date: isoOffset(-1),
      courseHint: 'ap-chem',
    },
    {
      id: 'mail_alg_quiz',
      from: 'Mr. Okonkwo <okonkwo@lincoln.edu>',
      to: 'maya@student.edu',
      subject: 'Quiz Monday: quadratics',
      preview: 'Bring a calculator. Review factoring and the formula.',
      body: 'Class,\n\nShort quiz Monday on quadratics. Bring a calculator. Review factoring and the quadratic formula.\n\nMr. Okonkwo',
      date: isoOffset(0),
      courseHint: 'algebra-ii',
    },
    {
      id: 'mail_eng_office',
      from: 'Ms. Cho <cho@lincoln.edu>',
      to: 'maya@student.edu',
      subject: 'Office hours moved to Thursday',
      preview: 'Come with your essay outline if you can.',
      body: 'Hi Maya,\n\nOffice hours moved to Thursday after school. Come with your essay outline if you can.\n\nMs. Cho',
      date: isoOffset(0),
      courseHint: 'english',
    },
  ];
}

/** @deprecated use buildSampleInbox() */
export const SAMPLE_INBOX = buildSampleInbox();

export function courseFromMail(mail) {
  if (mail.courseHint) {
    return COURSES.find((c) => c.id === mail.courseHint) || COURSES.at(-1);
  }
  const blob = `${mail.subject} ${mail.body} ${mail.from}`.toLowerCase();
  const rules = [
    [/chem|stoich|mole|lab report/, 'ap-chem'],
    [/algebra|quadratic|quiz monday/, 'algebra-ii'],
    [/history|reconstruction|civil war/, 'us-history'],
    [/english|essay|lit|office hours/, 'english'],
    [/bio|cell/, 'ap-bio'],
  ];
  for (const [re, id] of rules) {
    if (re.test(blob)) return COURSES.find((c) => c.id === id);
  }
  return COURSES.find((c) => c.id === 'unsorted');
}

export function draftReplyFor(mail) {
  const course = courseFromMail(mail);
  const first = (mail.from.match(/^([^<]+)/) || ['Teacher'])[1].trim();
  return {
    to: mail.from,
    subject: mail.subject.toLowerCase().startsWith('re:') ? mail.subject : `Re: ${mail.subject}`,
    body: `Hi ${first.split(' ')[0]},\n\nThanks for the note. I will turn this in on time.\n\nBest,\nMaya`,
    courseId: course.id,
    courseName: course.name,
    inReplyTo: mail.id,
  };
}

export function mailToCardFields(mail) {
  const course = courseFromMail(mail);
  const sem = semesterFromDate(mail.date);
  return {
    type: 'mail',
    badge: 'Inbox',
    title: mail.subject,
    from: mail.from,
    snippet: mail.preview || mail.body.slice(0, 160),
    body: mail.body,
    date: mail.date,
    courseId: course.id,
    courseName: course.name,
    semesterId: sem.id,
    semesterLabel: sem.label,
    mailId: mail.id,
  };
}

export function draftToCardFields(draft, date = new Date().toISOString().slice(0, 10)) {
  const course = COURSES.find((c) => c.id === draft.courseId) || COURSES.at(-1);
  const sem = semesterFromDate(date);
  return {
    type: 'draft',
    badge: 'Draft',
    title: draft.subject,
    from: draft.to,
    snippet: draft.body.slice(0, 160),
    body: draft.body,
    date,
    courseId: course.id,
    courseName: course.name,
    semesterId: sem.id,
    semesterLabel: sem.label,
    draftId: draft.id,
  };
}

export function buildLiveWeekIcs() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const d = (offset) => {
    const x = new Date();
    x.setHours(12, 0, 0, 0);
    x.setDate(x.getDate() + offset);
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const day = String(x.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  };
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//MindCraft Desk OS//Live//EN
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:chem-hw-${d(1)}@mindcraft.local
DTSTAMP:${stamp}
SUMMARY:AP Chem · Stoichiometry problem set
DTSTART;VALUE=DATE:${d(1)}
END:VEVENT
BEGIN:VEVENT
UID:alg-quiz-${d(4)}@mindcraft.local
DTSTAMP:${stamp}
SUMMARY:Algebra II quiz · Quadratics
DTSTART;VALUE=DATE:${d(4)}
END:VEVENT
BEGIN:VEVENT
UID:eng-essay-${d(8)}@mindcraft.local
DTSTAMP:${stamp}
SUMMARY:English essay draft due
DUE;VALUE=DATE:${d(8)}
DTSTART;VALUE=DATE:${d(8)}
END:VEVENT
END:VCALENDAR
`;
}
