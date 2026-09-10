/**
 * lib/alumniCompanies.ts
 *
 * Real companies where Macalester alumni work, used to bias
 * discover-internships.ts's search queries toward employers a student
 * actually has an alumni connection to, not a generic guess at job
 * boards. Source: a real, individually researched alumni career outcomes
 * dataset, LinkedIn career histories manually coded by industry and
 * function for an academic research project on career diversification,
 * not scraped.
 *
 * Deliberately NOT the full source dataset. That source also has real
 * names, grad years, and personal notes about real people who never
 * consented to their career history powering a startup job search
 * feature for other students, so none of that came over. What is here is
 * just: company name, the industry and function buckets that company's
 * roles were coded under, and how many alumni worked there, a plain
 * count, not tied to who. Filtered to real full time post grad roles
 * only, internships and campus jobs excluded, matching the source
 * research's own definition of a core post grad role.
 */
import alumniCompaniesData from './data/alumniCompanies.json'

export interface AlumniCompany {
  company: string
  industries: string[]
  functions: string[]
  alumniCount: number
}

const ALUMNI_COMPANIES = alumniCompaniesData as AlumniCompany[]

/**
 * Keyword overlap between a search topic and each company's coded
 * industry and function buckets, ranked by match strength then by
 * alumni count. Returns company names only, up to limit, empty if
 * nothing matches strongly.
 *
 * Requires at least 2 overlapping words, not 1: verified empirically that
 * a single-word threshold produces real false positives (topic
 * "healthcare research" matched Goldman Sachs, whose only overlap was the
 * generic word "research" inside "Investment Research", nothing to do
 * with healthcare). A weak or absent match is the safe failure mode here,
 * callers fall back to the generic queries; a wrong company name in front
 * of a student is not.
 */
export function matchAlumniCompanies(topic: string, limit = 2): string[] {
  const words = topic.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  if (words.length < 2) return []
  const scored = ALUMNI_COMPANIES.map((c) => {
    const haystack = [...c.industries, ...c.functions].join(' ').toLowerCase()
    const score = words.filter((w) => haystack.includes(w)).length
    return { company: c.company, score, alumniCount: c.alumniCount }
  })
    .filter((c) => c.score >= 2)
    .sort((a, b) => b.score - a.score || b.alumniCount - a.alumniCount)
  return scored.slice(0, limit).map((c) => c.company)
}

/**
 * Whether a company name the LLM extracted from a search result matches
 * a real alumni employer. Case-insensitive, substring-tolerant in both
 * directions since the model's own wording ("Goldman Sachs" vs "Goldman
 * Sachs Group") will not always match the dataset's exact string.
 */
export function isAlumniCompany(candidateCompany: string): boolean {
  const name = candidateCompany.trim().toLowerCase()
  if (!name) return false
  return ALUMNI_COMPANIES.some((c) => {
    const known = c.company.toLowerCase()
    return name.includes(known) || known.includes(name)
  })
}
