import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
import { useUser } from '../App'
import {
  collection, addDoc, onSnapshot, orderBy, query,
  doc, setDoc, serverTimestamp, getDoc,
} from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase'
import s from './Chat.module.css'

interface Message {
  id: string
  senderId: string
  text: string
  fileUrl: string | null
  fileName: string | null
  fileType: string | null
  createdAt: any
}

export default function Chat() {
  const user = useUser()
  const navigate = useNavigate()
  const location = useLocation()
  const { partnerId } = useParams<{ partnerId: string }>()
  const chatId = partnerId ? [user.uid, partnerId].sort().join('_') : ''

  const [messages, setMessages]       = useState<Message[]>([])
  const [text, setText]               = useState('')
  const [partnerName, setPartnerName] = useState('...')
  const [backTo, setBackTo]           = useState('/dashboard')
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [sending, setSending]         = useState(false)
  const [error, setError]             = useState('')
  const fileRef  = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Guard: no partner → leave chat (avoids writing to a broken chat id).
  useEffect(() => {
    if (!partnerId || partnerId === user.uid) {
      navigate('/dashboard', { replace: true })
    }
  }, [partnerId, user.uid, navigate])

  // Back target: role home (tutors → /tutor), not marketing /
  useEffect(() => {
    const fromState = (location.state as { from?: string } | null)?.from
    if (fromState && fromState.startsWith('/')) {
      setBackTo(fromState)
      return
    }
    void getDoc(doc(db, 'users', user.uid)).then(snap => {
      const role = snap.data()?.role
      if (role === 'tutor' || role === 'admin') setBackTo('/tutor')
      else if (role === 'parent') setBackTo('/parent')
      else setBackTo('/dashboard')
    }).catch(() => setBackTo('/dashboard'))
  }, [user.uid, location.state])

  // Load partner name
  useEffect(() => {
    if (!partnerId) return
    getDoc(doc(db, 'users', partnerId)).then(snap => {
      if (snap.exists()) {
        const d = snap.data()
        setPartnerName(d.displayName || d.email?.split('@')[0] || 'User')
      } else {
        setPartnerName('User')
      }
    }).catch(() => setPartnerName('User'))
  }, [partnerId])

  // Real-time messages
  useEffect(() => {
    if (!chatId) return
    const unsub = onSnapshot(
      query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc')),
      snap => {
        setError('')
        setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)))
      },
      err => {
        console.error('[chat] listen failed', err)
        setError('Could not load messages. Try refreshing.')
      },
    )
    return () => unsub()
  }, [chatId])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(fileUrl?: string, fileName?: string, fileType?: string) {
    if (!partnerId || !chatId) return
    if (!text.trim() && !fileUrl) return
    setSending(true)
    setError('')
    const msg = {
      senderId: user.uid,
      text: text.trim(),
      fileUrl: fileUrl ?? null,
      fileName: fileName ?? null,
      fileType: fileType ?? null,
      createdAt: serverTimestamp(),
    }
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), msg)
      await setDoc(doc(db, 'chats', chatId), {
        participants: [user.uid, partnerId],
        lastMessage: fileUrl ? `📎 ${fileName}` : text.trim(),
        lastAt: serverTimestamp(),
      }, { merge: true })
      setText('')
    } catch (err) {
      console.error('[chat] send failed', err)
      setError('Message failed to send. Check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !chatId) return
    setError('')
    const path = `chat-files/${chatId}/${Date.now()}_${file.name}`
    const storageRef = ref(storage, path)
    const task = uploadBytesResumable(storageRef, file)
    task.on('state_changed',
      snap => setUploadProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
      err => {
        console.error('[chat] upload failed', err)
        setUploadProgress(null)
        setError('File upload failed. Try a smaller file.')
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref)
          const type = file.type.startsWith('image/') ? 'image'
            : file.type === 'application/pdf' ? 'pdf' : 'doc'
          await sendMessage(url, file.name, type)
        } catch (err) {
          console.error('[chat] upload finalize failed', err)
          setError('File upload failed.')
        } finally {
          setUploadProgress(null)
          e.target.value = ''
        }
      }
    )
  }

  if (!partnerId || partnerId === user.uid) return null

  return (
    <div className={s.shell}>
      <div className={s.header}>
        <Link to={backTo} className={s.back} aria-label="Back">←</Link>
        <div className={s.headerInfo}>
          <div className={s.avatar}>{partnerName[0]?.toUpperCase()}</div>
          <div>
            <div className={s.partnerName}>{partnerName}</div>
            <div className={s.subtext}>MindCraft Chat</div>
          </div>
        </div>
      </div>

      <div className={s.messages}>
        {messages.length === 0 && !error && (
          <div className={s.empty}>No messages yet. Say hi!</div>
        )}
        {messages.map(msg => {
          const isMe = msg.senderId === user.uid
          return (
            <div key={msg.id} className={`${s.bubble} ${isMe ? s.mine : s.theirs}`}>
              {!isMe && <div className={s.senderName}>{partnerName}</div>}
              {msg.text && <p>{msg.text}</p>}
              {msg.fileUrl && msg.fileType === 'image' && (
                <a href={msg.fileUrl} target="_blank" rel="noopener">
                  <img src={msg.fileUrl} alt={msg.fileName ?? 'image'} className={s.imgPreview} />
                </a>
              )}
              {msg.fileUrl && msg.fileType !== 'image' && (
                <a href={msg.fileUrl} target="_blank" rel="noopener" className={s.fileChip}>
                  <span className={s.fileIcon}>{msg.fileType === 'pdf' ? '📄' : '📎'}</span>
                  {msg.fileName}
                </a>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {error && <div className={s.errorBanner}>{error}</div>}

      {uploadProgress !== null && (
        <div className={s.progressBar}>
          <div className={s.progressFill} style={{ width: `${uploadProgress}%` }} />
        </div>
      )}

      <div className={s.inputRow}>
        <button className={s.attachBtn} onClick={() => fileRef.current?.click()} title="Attach file">
          📎
        </button>
        <input ref={fileRef} type="file" style={{ display: 'none' }}
          accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif"
          onChange={handleFile} />
        <input
          className={s.textInput}
          placeholder="Message..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), void sendMessage())}
        />
        <button className={s.sendBtn} onClick={() => void sendMessage()} disabled={sending || !text.trim()}>
          Send
        </button>
      </div>
    </div>
  )
}
