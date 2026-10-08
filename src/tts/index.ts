import { WasmBridge } from './wasmMode/bridge'

export { WasmBridge } from './wasmMode/bridge'
export { ZeroTTSEngine } from './engine/ZeroTTSEngine'
export { BpeTokenizer } from './engine/tokenizer'
export { MossCodecDecoder } from './engine/codec'
export * from './engine/types'
export * from './engine/wavHelper'

export async function activateTTS(novel: NovelExtensionApi): Promise<void> {
  if (!novel.tts) return

  await novel.logger?.info?.('[activateTTS] Registering ZeroTTS CPU Handlers...')

  const bridge = new WasmBridge(novel)
  await novel.tts.register({
    getVoices: async () => bridge.getVoices(),
    speak: async (params: ExtensionTTSSpeakRequest) => bridge.speak(params),
    stop: async () => bridge.stop(),
  })

  // Preload / warm-up mô hình trong nền ngay sau khi kích hoạt (không block activate)
  bridge
    .initialize()
    .then(() => {
      novel.logger?.info?.('🎉 ZeroTTS models preloaded successfully in background!')
    })
    .catch((err: unknown) => {
      const errMsg = err instanceof Error ? err.message : String(err)
      novel.logger?.warn?.(`[ZeroTTS] Background preload note: ${errMsg}`)
    })

  // Register settings action for voice previewing
  if (novel.settings) {
    await novel.settings.register({
      previewVoice: async (fieldValues: Record<string, unknown>) => {
        const voiceId = typeof fieldValues.voice === 'string' ? fieldValues.voice : 'maichi'
        const previewText =
          typeof fieldValues.previewText === 'string' && fieldValues.previewText.trim()
            ? fieldValues.previewText.trim()
            : 'Xin chào, đây là giọng đọc tiếng Việt nhân tạo chất lượng cao chạy trên CPU.'

        await novel.logger?.info?.(
          `[Settings.previewVoice] Triggered with voiceId=${voiceId}, text="${previewText}"`
        )

        try {
          const result = await bridge.speak({
            text: previewText,
            voiceId,
            config: fieldValues,
          })

          return {
            success: true,
            message: `Đã tổng hợp âm thanh mẫu (${voiceId})`,
            audio: result.audio,
            mimeType: result.mimeType || 'audio/wav',
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err)
          await novel.logger?.error?.(`[Settings.previewVoice] Error: ${errMsg}`)
          return {
            success: false,
            message: errMsg,
          }
        }
      },
    })
  }
}
