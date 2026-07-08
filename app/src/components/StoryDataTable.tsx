import type { ParsedTable } from '../lib/storyDisplay'
import s from './StoryDataTable.module.css'

interface Props {
  table: ParsedTable
  accent?: string
}

export default function StoryDataTable({ table, accent = '#1d3a8a' }: Props) {
  return (
    <div className={s.wrap} style={{ borderColor: `${accent}33` }}>
      <table className={s.table}>
        <thead>
          <tr>
            {table.headers.map(h => (
              <th key={h} style={{ color: accent }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className={ci === 0 ? s.label : undefined}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
