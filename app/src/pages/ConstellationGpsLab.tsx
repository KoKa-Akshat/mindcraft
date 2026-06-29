/**
 * Full-page lab shell for the constellation + GPS route explorer.
 * /constellation-gps-lab
 */
import Sidebar from '../components/Sidebar'
import ConstellationGpsExplorer from '../components/ConstellationGpsExplorer'
import s from './ConstellationGpsLab.module.css'

export default function ConstellationGpsLab() {
  return (
    <div className={s.page}>
      <Sidebar />
      <div className={s.content}>
        <ConstellationGpsExplorer />
      </div>
    </div>
  )
}
