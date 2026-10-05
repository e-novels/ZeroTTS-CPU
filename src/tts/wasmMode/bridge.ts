import { ZeroTTSEngine } from '../engine/ZeroTTSEngine'
import { createWavBase64 } from '../engine/wavHelper'

export class WasmBridge {
  private engine: ZeroTTSEngine
  private isStopped = false

  constructor(private novel: NovelExtensionApi) {
    this.engine = new ZeroTTSEngine(novel)
  }

  private async log(message: string, ...args: any[]): Promise<void> {
    const formatted = `[WasmBridge] ${message}`
    if (this.novel.logger?.info) {
      await this.novel.logger.info(formatted, ...args)
    } else {
      console.log(formatted, ...args)
    }
  }

  async initialize(): Promise<void> {
    await this.engine.initialize()
  }

  async getVoices(): Promise<ExtensionTTSGetVoicesResponse> {
    await this.initialize()
    const voicesRes = this.engine.getVoices()
    await this.log(`getVoices() returning ${voicesRes.voices.length} ZeroTTS voices`)
    return voicesRes
  }

  async speak(request: ExtensionTTSSpeakRequest): Promise<ExtensionTTSSpeakResponse> {
    const startTime = Date.now()
    this.isStopped = false
    await this.initialize()

    const text = request.text || ''
    const config = (request.config || {}) as Record<string, unknown>
    let voiceId = request.voiceId
    if (!voiceId && typeof config.voice === 'string' && config.voice) {
      voiceId = config.voice
    }
    voiceId = this.engine.resolveVoiceId(voiceId || 'maichi')

    const temperature = typeof config.temperature === 'number' ? config.temperature : 0.8
    const audioRepetitionPenalty =
      typeof config.audioRepetitionPenalty === 'number' ? config.audioRepetitionPenalty : 1.2
    const cfgScale = typeof config.cfgScale === 'number' ? config.cfgScale : 1.0

    await this.log(
      `[Speak Start] text="${text.substring(0, 80)}${text.length > 80 ? '...' : ''}", voiceId=${voiceId}, cfgScale=${cfgScale}, temp=${temperature}`
    )

    const audioPcm = await this.engine.synthesize(text, voiceId, {
      audioTemperature: temperature,
      audioRepetitionPenalty,
      cfgScale,
    })

    const durationSec = (audioPcm.length / ZeroTTSEngine.SAMPLE_RATE).toFixed(2)
    const base64Audio = createWavBase64(audioPcm, ZeroTTSEngine.SAMPLE_RATE)

    await this.log(
      `[Speak Complete] Generated ${audioPcm.length} samples at ${ZeroTTSEngine.SAMPLE_RATE}Hz (${durationSec}s audio) in ${Date.now() - startTime}ms`
    )

    return {
      audio: base64Audio,
      mimeType: 'audio/wav',
    }
  }

  async stop(): Promise<ExtensionTTSStopResponse> {
    await this.log('stop() called')
    this.isStopped = true
    return { success: true }
  }
}
