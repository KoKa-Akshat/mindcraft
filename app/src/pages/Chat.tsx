import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
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
  const { partnerId } = useParams<{ partnerId: string }>()
  const chatId = [user.uid, partnerId!].sort().join('_')

  const [messages, setMessages]       = useState<Message[]>([])
  const [text, setText]               = useState('')
  const [partnerName, setPartnerName] = useState('...')
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [sending, setSending]         = useState(false)
  const fileRef  = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load partner name
  useEffect(() => {
    if (!partnerId) return
    getDoc(doc(db, 'users', partnerId)).then(snap => {
      if (snap.exists()) {
        const d = snap.data()
        setPartnerName(d.displayName || d.email?.split('@')[0] || 'User')
      }
    })
  }, [partnerId])

  // Real-time messages
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc')),
      snap => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)))
    )
    return () => unsub()
  }, [chatId])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(fileUrl?: string, fileName?: string, fileType?: string) {
    if (!text.trim() && !fileUrl) return
    setSending(true)
    const msg = {
      senderId: user.uid,
      text: text.trim(),
      fileUrl: fileUrl ?? null,
      fileName: fileName ?? null,
      fileType: fileType ?? null,
      createdAt: serverTimestamp(),
    }
    await addDoc(collection(db, 'chats', chatId, 'messages'), msg)
    await setDoc(doc(db, 'chats', chatId), {
      participants: [user.uid, partnerId],
      lastMessage: fileUrl ? `📎 ${fileName}` : text.trim(),
      lastAt: serverTimestamp(),
    }, { merge: true })
    setText('')
    setSending(false)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const path = `chat-files/${chatId}/${Date.now()}_${file.name}`
    const storageRef = ref(storage, path)
    const task = uploadBytesResumable(storageRef, file)
    task.on('state_changed',
      snap => setUploadProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
      () => setUploadProgress(null),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        const type = file.type.startsWith('image/') ? 'image'
          : file.type === 'application/pdf' ? 'pdf' : 'doc'
        await sendMessage(url, file.name, type)
        setUploadProgress(null)
        e.target.value = ''
      }
    )
  }

  const myName = user.displayName || user.email?.split('@')[0] || 'You'

  return (
    <div className={s.shell}>
      <div className={s.header}>
        <Link to="/" className={s.back}>←</Link>
        <div className={s.headerInfo}>
          <div className={s.avatar}>{partnerName[0]?.toUpperCase()}</div>
          <div>
            <div className={s.partnerName}>{partnerName}</div>
            <div className={s.subtext}>MindCraft Chat</div>
          </div>
        </div>
      </div>

      <div className={s.messages}>
        {messages.length === 0 && (
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
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
        />
        <button className={s.sendBtn} onClick={() => sendMessage()} disabled={sending || !text.trim()}>
          Send
        </button>
      </div>
    </div>
  )
}
