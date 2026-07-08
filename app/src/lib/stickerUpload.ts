import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase'
import type { CustomSticker } from './dashboardPersonalization'

const MAX_BYTES = 300 * 1024
const MAX_SIDE = 512
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'] as const

export function acceptedStickerMime(file: File): boolean {
  return ACCEPTED_TYPES.includes(file.type as typeof ACCEPTED_TYPES[number])
}

export async function resizeStickerImage(file: File): Promise<Blob> {
  if (file.type === 'image/svg+xml') {
    if (file.size > MAX_BYTES) throw new Error('Sticker must be 300KB or smaller after resize.')
    return file
  }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not prepare image.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const mime = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png'
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => {
      if (!result) reject(new Error('Could not resize image.'))
      else resolve(result)
    }, mime, mime === 'image/jpeg' ? 0.88 : undefined)
  })

  if (blob.size > MAX_BYTES) {
    throw new Error('Sticker must be 300KB or smaller after resize.')
  }
  return blob
}

function extForMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/svg+xml') return 'svg'
  return 'png'
}

export async function uploadCustomSticker(uid: string, file: File): Promise<CustomSticker> {
  if (!acceptedStickerMime(file)) {
    throw new Error('Use a PNG, JPEG, or SVG image.')
  }

  const blob = await resizeStickerImage(file)
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  const ext = extForMime(blob.type || file.type)
  const storagePath = `users/${uid}/stickers/${id}.${ext}`
  const storageRef = ref(storage, storagePath)

  await uploadBytes(storageRef, blob, { contentType: blob.type || file.type })
  const url = await getDownloadURL(storageRef)

  return {
    id,
    url,
    storagePath,
    uploadedAt: Date.now(),
  }
}
