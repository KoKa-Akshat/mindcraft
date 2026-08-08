/** US school-year terms. Aug-Dec Fall, Jan-May Spring, Jun-Jul Summer. */

export function semesterFromDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return semesterFromDate(new Date().toISOString().slice(0, 10));
  }
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  if (m >= 8) return { id: `fall-${y}`, label: `Fall ${y}` };
  if (m >= 6) return { id: `summer-${y}`, label: `Summer ${y}` };
  return { id: `spring-${y}`, label: `Spring ${y}` };
}

export function currentSemester(now = new Date()) {
  return semesterFromDate(now.toISOString().slice(0, 10));
}

export function itemSemester(item) {
  if (item?.semesterId && item?.semesterLabel) {
    return { id: item.semesterId, label: item.semesterLabel };
  }
  return semesterFromDate(item?.date);
}

/** Newest term first. */
export function compareSemesterIds(a, b) {
  const parse = (id) => {
    const [term, y] = String(id).split('-');
    const rank = term === 'fall' ? 3 : term === 'summer' ? 2 : 1;
    return Number(y) * 10 + rank;
  };
  return parse(b) - parse(a);
}

export function unitSortKey(unit) {
  const u = String(unit || 'Inbox');
  const n = u.match(/unit\s*(\d+)/i);
  if (n) return Number(n[1]);
  if (/^inbox$/i.test(u)) return 999;
  return 500;
}
