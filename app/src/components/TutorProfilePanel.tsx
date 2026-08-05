/**
 * Editable tutor profile for Tutor Dashboard.
 * Fields land on users/{uid}: displayName, bio, subjects, photoUrl, resumeUrl, locationAddress.
 * `subjects` is read by FindTutor.tsx on the booking page.
 */
import { useEffect, useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase'
import type { User } from 'firebase/auth'
import s from './TutorProfilePanel.module.css'

export type TutorProfileData = {
  displayName: string
  email: string
  bio: string
  subjects: string[]
  photoUrl: string | null
  resumeUrl: string | null
  locationAddress: string | null
}

type Props = {
  user: User
  initial: TutorProfileData
  onSaved: (next: TutorProfileData) => void
  onToast: (msg: string) => void
}

const MAX_BYTES = 8 * 1024 * 1024

/** Common chips; tutors can also add a custom label below. */
const SUBJECT_SUGGESTIONS = [
  'ACT Math',
  'SAT Prep',
  'Algebra',
  'Pre-Calc',
  'Calculus',
  'AP Calculus',
  'Statistics',
  'Proofs',
  'AP Physics',
  'Chemistry',
]

function normalizeSubjects(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const label = item.trim().replace(/\s+/g, ' ')
    if (!label) continue
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(label)
  }
  return out.slice(0, 12)
}

export default function TutorProfilePanel({ user, initial, onSaved, onToast }: Props) {
  const [name, setName] = useState(initial.displayName)
  const [bio, setBio] = useState(initial.bio)
  const [subjects, setSubjects] = useState<string[]>(() => normalizeSubjects(initial.subjects))
  const [customSubject, setCustomSubject] = useState('')
  const [location, setLocation] = useState(initial.locationAddress ?? '')
  const [photoUrl, setPhotoUrl] = useState(initial.photoUrl)
  const [resumeUrl, setResumeUrl] = useState(initial.resumeUrl)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'photo' | 'resume' | null>(null)

  useEffect(() => {
    setName(initial.displayName)
    setBio(initial.bio)
    setSubjects(normalizeSubjects(initial.subjects))
    setCustomSubject('')
    setLocation(initial.locationAddress ?? '')
    setPhotoUrl(initial.photoUrl)
    setResumeUrl(initial.resumeUrl)
  }, [initial])

  function toggleSubject(label: string) {
    setSubjects(prev => {
      const key = label.toLowerCase()
      if (prev.some(s => s.toLowerCase() === key)) {
        return prev.filter(s => s.toLowerCase() !== key)
      }
      if (prev.length >= 12) {
        onToast('Keep it to 12 subjects')
        return prev
      }
      return [...prev, label]
    })
  }

  function addCustomSubject() {
    const label = customSubject.trim().replace(/\s+/g, ' ')
    if (!label) return
    setSubjects(prev => {
      if (prev.some(s => s.toLowerCase() === label.toLowerCase())) return prev
      if (prev.length >= 12) {
        onToast('Keep it to 12 subjects')
        return prev
      }
      return [...prev, label]
    })
    setCustomSubject('')
  }

  async function uploadFile(file: File, kind: 'photo' | 'resume') {
    if (file.size > MAX_BYTES) {
      onToast('Keep each file under 8MB')
      return null
    }
    setUploading(kind)
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(0, 80)
      const path = `users/${user.uid}/profile/${kind}-${Date.now()}-${safe}`
      const storageRef = ref(storage, path)
      await uploadBytes(storageRef, file)
      return await getDownloadURL(storageRef)
    } catch {
      onToast('Upload failed. Try a smaller file')
      return null
    } finally {
      setUploading(null)
    }
  }

  async function onPhotoChange(file: File | undefined) {
    if (!file) return
    const url = await uploadFile(file, 'photo')
    if (url) setPhotoUrl(url)
  }

  async function onResumeChange(file: File | undefined) {
    if (!file) return
    const url = await uploadFile(file, 'resume')
    if (url) setResumeUrl(url)
  }

  async function save() {
    setSaving(true)
    try {
      const nextSubjects = normalizeSubjects(subjects)
      const payload: Record<string, unknown> = {
        displayName: name.trim() || initial.displayName,
        bio: bio.trim(),
        subjects: nextSubjects,
        photoUrl: photoUrl || null,
        resumeUrl: resumeUrl || null,
      }
      // Location text can be edited here; pin/geocode still via Location chip.
      if (location.trim()) payload.locationAddress = location.trim()
      await updateDoc(doc(db, 'users', user.uid), payload)
      const next: TutorProfileData = {
        displayName: String(payload.displayName),
        email: initial.email,
        bio: String(payload.bio),
        subjects: nextSubjects,
        photoUrl: photoUrl,
        resumeUrl: resumeUrl,
        locationAddress: location.trim() || null,
      }
      onSaved(next)
      onToast('Profile saved')
    } catch {
      onToast('Could not save profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={s.panel}>
      <div className={s.head}>
        <span className={s.label}>Your profile</span>
        <button type="button" className={s.save} disabled={saving || !!uploading} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className={s.photoRow}>
        <div className={s.photo}>
          {photoUrl ? <img src={photoUrl} alt="" /> : <span>{(name || 'T')[0]?.toUpperCase()}</span>}
        </div>
        <label className={s.upload}>
          {uploading === 'photo' ? 'Uploading…' : 'Change photo'}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={e => void onPhotoChange(e.target.files?.[0])}
          />
        </label>
      </div>

      <label className={s.field}>
        Name
        <input value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
      </label>
      <label className={s.field}>
        Email
        <input value={initial.email} readOnly />
      </label>
      <label className={s.field}>
        Bio
        <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4} placeholder="Who you are. What you teach best." />
      </label>
      <div className={s.field}>
        <span>Subjects</span>
        <p className={s.hint}>Shown on Find a Tutor. Tap to toggle; add your own if needed.</p>
        <div className={s.chipRow}>
          {SUBJECT_SUGGESTIONS.map(label => {
            const on = subjects.some(s => s.toLowerCase() === label.toLowerCase())
            return (
              <button
                key={label}
                type="button"
                className={`${s.chip} ${on ? s.chipOn : ''}`}
                onClick={() => toggleSubject(label)}
                aria-pressed={on}
              >
                {label}
              </button>
            )
          })}
          {subjects
            .filter(label => !SUBJECT_SUGGESTIONS.some(s => s.toLowerCase() === label.toLowerCase()))
            .map(label => (
              <button
                key={label}
                type="button"
                className={`${s.chip} ${s.chipOn}`}
                onClick={() => toggleSubject(label)}
                aria-pressed
              >
                {label}
              </button>
            ))}
        </div>
        <div className={s.customRow}>
          <input
            value={customSubject}
            onChange={e => setCustomSubject(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCustomSubject()
              }
            }}
            placeholder="Add a subject"
            maxLength={40}
          />
          <button type="button" className={s.addBtn} onClick={addCustomSubject} disabled={!customSubject.trim()}>
            Add
          </button>
        </div>
      </div>
      <label className={s.field}>
        Location
        <input
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="St Paul, MN or Chapel Hill, NC"
          autoComplete="address-level2"
        />
      </label>
      <div className={s.field}>
        <span>Resume</span>
        <div className={s.resumeRow}>
          {resumeUrl ? (
            <a href={resumeUrl} target="_blank" rel="noopener noreferrer">View current resume</a>
          ) : (
            <span className={s.muted}>No resume yet</span>
          )}
          <label className={s.upload}>
            {uploading === 'resume' ? 'Uploading…' : 'Attach resume'}
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf"
              hidden
              onChange={e => void onResumeChange(e.target.files?.[0])}
            />
          </label>
        </div>
      </div>
    </div>
  )
}
