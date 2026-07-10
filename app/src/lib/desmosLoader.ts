/**
 * Singleton loader for the Desmos Graphing Calculator API.
 * Never blocks first paint — call loadDesmos() from useEffect only.
 */

const DEMO_API_KEY = 'dcb31709b452b1cf966dc6a72eb00620'

export interface DesmosExpression {
  setExpression: (state: { id?: string; latex: string; color?: string; pointStyle?: string }) => void
  setMathBounds: (bounds: { left: number; right: number; bottom: number; top: number }) => void
  destroy: () => void
}

export interface DesmosCalculator {
  setExpression: DesmosExpression['setExpression']
  setMathBounds: DesmosExpression['setMathBounds']
  destroy: () => void
}

export interface DesmosApi {
  GraphingCalculator: (
    el: HTMLElement,
    options?: Record<string, unknown>,
  ) => DesmosCalculator
}

declare global {
  interface Window {
    Desmos?: DesmosApi
  }
}

function desmosScriptUrl(): string {
  const key = import.meta.env.VITE_DESMOS_API_KEY || DEMO_API_KEY
  return `https://www.desmos.com/api/v1.9/calculator.js?apiKey=${key}`
}

let loadPromise: Promise<DesmosApi | null> | null = null

export function loadDesmos(): Promise<DesmosApi | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.Desmos) return Promise.resolve(window.Desmos)

  if (!loadPromise) {
    loadPromise = new Promise((resolve) => {
      const existing = document.querySelector('script[data-desmos-api]')
      if (existing) {
        existing.addEventListener('load', () => resolve(window.Desmos ?? null))
        existing.addEventListener('error', () => resolve(null))
        return
      }

      const script = document.createElement('script')
      script.src = desmosScriptUrl()
      script.async = true
      script.dataset.desmosApi = '1'
      script.onload = () => resolve(window.Desmos ?? null)
      script.onerror = () => resolve(null)
      document.head.appendChild(script)
    })
  }

  return loadPromise
}
