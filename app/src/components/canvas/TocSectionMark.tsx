/**
 * Tiny section mark for Contents lanes — warm-up / algebra / geometry / data.
 * Matches the notebook ink palette; no emoji puns.
 */
import type { ActTocSectionId } from '../../lib/actToc'

export default function TocSectionMark({
  id,
  accent,
}: {
  id: ActTocSectionId
  accent: string
}) {
  return (
    <svg
      className="tocSectionMark"
      viewBox="0 0 32 32"
      width="28"
      height="28"
      aria-hidden
    >
      <circle cx="16" cy="16" r="15" fill="#fffdf8" stroke={accent} strokeWidth="1.8" />
      {id === 'warmups' && (
        <>
          <path
            d="M16 7c2 3 5 5 5 9a5 5 0 1 1-10 0c0-4 3-6 5-9z"
            fill="none"
            stroke={accent}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M14 18c.5 2 2 3 2 3s1.5-1 2-3" fill="none" stroke={accent} strokeWidth="1.4" />
        </>
      )}
      {id === 'algebra' && (
        <>
          <text
            x="16"
            y="21"
            textAnchor="middle"
            fontFamily="Georgia, serif"
            fontSize="15"
            fontWeight="700"
            fill={accent}
          >
            x
          </text>
          <path d="M9 11h14" stroke={accent} strokeWidth="1.4" opacity="0.45" />
        </>
      )}
      {id === 'geometry' && (
        <path
          d="M8 22 L16 8 L24 22 Z"
          fill="none"
          stroke={accent}
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
      )}
      {id === 'data' && (
        <>
          <rect x="9" y="9" width="14" height="14" rx="2.5" fill="none" stroke={accent} strokeWidth="1.8" />
          <circle cx="13" cy="13" r="1.3" fill={accent} />
          <circle cx="19" cy="13" r="1.3" fill={accent} />
          <circle cx="16" cy="16" r="1.3" fill={accent} />
          <circle cx="13" cy="19" r="1.3" fill={accent} />
          <circle cx="19" cy="19" r="1.3" fill={accent} />
        </>
      )}
    </svg>
  )
}
