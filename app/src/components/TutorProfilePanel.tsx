/**
 * Editable tutor profile for Tutor Dashboard.
 * Fields land on users/{uid}: displayName, bio, photoUrl, resumeUrl, locationAddress.
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

export default function TutorProfilePanel({ user, initial, onSaved, onToast }: Props) {
  const [name, setName] = useState(initial.displayName)
  const [bio, setBio] = useState(initial.bio)
  const [location, setLocation] = useState(initial.locationAddress ?? '')
  const [photoUrl, setPhotoUrl] = useState(initial.photoUrl)
  const [resumeUrl, setResumeUrl] = useState(initial.resumeUrl)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'photo' | 'resume' | null>(null)

  useEffect(() => {
    setName(initial.displayName)
    setBio(initial.bio)
    setLocation(initial.locationAddress ?? '')
    setPhotoUrl(initial.photoUrl)
    setResumeUrl(initial.resumeUrl)
  }, [initial])

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
      const payload: Record<string, unknown> = {
        displayName: name.trim() || initial.displayName,
        bio: bio.trim(),
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
