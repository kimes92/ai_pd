import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const WHISPER_SUPPORTED_EXTENSIONS = new Set([
  'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'ogg', 'wav', 'webm', 'flac'
])

function mimeTypeToExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/m4a': 'm4a',
    'audio/ogg': 'ogg',
    'audio/flac': 'flac',
  }
  return map[mimeType.toLowerCase()] || 'webm'
}

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String: string, chunkSize = 32768) {
  const chunks: Uint8Array[] = [];
  let position = 0;

  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);

    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }

    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { audio, mimeType, prompt, model } = await req.json()

    if (!audio) {
      throw new Error('No audio data provided')
    }

    const resolvedMimeType = typeof mimeType === 'string' && mimeType.startsWith('audio/')
      ? mimeType
      : 'audio/webm'

    const extension = mimeTypeToExtension(resolvedMimeType)
    if (!WHISPER_SUPPORTED_EXTENSIONS.has(extension)) {
      throw new Error(`Unsupported audio format: ${extension}`)
    }

    console.log('📥 Received audio data, mimeType:', resolvedMimeType, 'extension:', extension)

    // Process audio in chunks
    const binaryAudio = processBase64Chunks(audio)

    console.log('📊 Audio size:', binaryAudio.length, 'bytes')

    // Prepare form data
    const formData = new FormData()
    const blob = new Blob([binaryAudio], { type: resolvedMimeType })
    formData.append('file', blob, `audio.${extension}`)
    const modelId =
      typeof model === 'string' && model.startsWith('openai/')
        ? model
        : 'openai/gpt-4o-mini-transcribe'
    formData.append('model', modelId)
    formData.append('language', 'ko')
    if (typeof prompt === 'string' && prompt.length > 0) {
      formData.append('prompt', prompt.slice(0, 800))
    }

    console.log('🚀 Sending to Lovable AI Gateway transcription...')

    const lovableKey = Deno.env.get('LOVABLE_API_KEY')
    if (!lovableKey) {
      throw new Error('LOVABLE_API_KEY is not configured')
    }

    // Send to Lovable AI Gateway (OpenAI-compatible transcription endpoint)
    const response = await fetch('https://ai.gateway.lovable.dev/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ OpenAI API error:', response.status, errorText)
      throw new Error(`OpenAI API error: ${errorText}`)
    }

    const result = await response.json()
    console.log('✅ Transcription successful:', result.text)

    return new Response(
      JSON.stringify({ text: result.text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in voice-to-text:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

