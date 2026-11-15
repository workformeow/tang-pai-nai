/** One server-sent event: its name and the JSON of its `data` lines. */
export interface StreamEvent {
  event: string
  data: string
}

/**
 * Reads a `text/event-stream` body (live-sync rule 9) and hands each event over. Answers when the
 * stream ends; throws when the read fails or is aborted.
 */
export const readEventStream = async (
  body: ReadableStream<Uint8Array>,
  onEvent: (event: StreamEvent) => void
): Promise<void> => {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) {
      return
    }
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, '\n')
    let end = buffer.indexOf('\n\n')
    while (end >= 0) {
      const block = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      const event = parseBlock(block)
      if (event) {
        onEvent(event)
      }
      end = buffer.indexOf('\n\n')
    }
  }
}

/** Comment lines (`: ping`) and events without data are skipped. */
const parseBlock = (block: string): StreamEvent | null => {
  let event = 'message'
  const data: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      data.push(line.slice(5).trimStart())
    }
  }
  return data.length > 0 ? { event, data: data.join('\n') } : null
}
