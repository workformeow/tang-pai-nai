import { readEventStream } from './live-stream'
import type { StreamEvent } from './live-stream'

const streamOf = (chunks: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

describe('readEventStream', () => {
  it('hands over each event, skipping comment lines', async () => {
    const events: StreamEvent[] = []
    await readEventStream(
      streamOf([': open\n\n', 'event: poke\ndata: {"seq":1}\n\n', ': ping\n\n']),
      (event) => events.push(event)
    )
    expect(events).toEqual([{ event: 'poke', data: '{"seq":1}' }])
  })

  it('joins an event split across chunks, and reads CRLF line ends', async () => {
    const events: StreamEvent[] = []
    await readEventStream(
      streamOf(['event: po', 'ke\r\ndata: {"seq"', ':2}\r\n\r\ndata: x\n\n']),
      (event) => events.push(event)
    )
    expect(events).toEqual([
      { event: 'poke', data: '{"seq":2}' },
      { event: 'message', data: 'x' },
    ])
  })
})
