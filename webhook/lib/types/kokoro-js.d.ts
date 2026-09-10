// kokoro-js only exposes its types via package.json's `exports.types`
// (no top-level `types` field), which this project's classic Node module
// resolution (no explicit `moduleResolution` in tsconfig.json) doesn't
// follow. A project-wide tsconfig change is out of scope for one handler,
// so this is a minimal ambient shim covering only what tts.ts actually
// uses - see node_modules/kokoro-js/types/kokoro.d.ts for the full surface.
declare module 'kokoro-js' {
  export class RawAudio {
    audio: Float32Array
    sampling_rate: number
    toWav(): ArrayBuffer
  }

  export class KokoroTTS {
    static from_pretrained(
      modelId: string,
      options?: {
        dtype?: 'fp32' | 'fp16' | 'q8' | 'q4' | 'q4f16'
        device?: 'wasm' | 'webgpu' | 'cpu' | null
        progress_callback?: (...args: unknown[]) => void
      },
    ): Promise<KokoroTTS>

    generate(text: string, options?: { voice?: string; speed?: number }): Promise<RawAudio>
  }
}
