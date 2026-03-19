type SSEEventType = 'dr-ops' | 'dr-status' | 'counts'
type SSEEventHandler = (data: any) => void

interface SSEListener {
  type: SSEEventType
  handler: SSEEventHandler
}

class SSEClient {
  private source: EventSource | null = null
  private listeners: SSEListener[] = []
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private connectedUrl = '/api/v1/events'

  connect(url = '/api/v1/events') {
    this.connectedUrl = url
    if (this.source) return

    const source = new EventSource(url, { withCredentials: true })
    this.source = source

    source.onopen = () => {
      this.reconnectAttempts = 0
    }

    source.onerror = () => {
      this.cleanupSource()
      this.scheduleReconnect()
    }

    for (const type of ['dr-ops', 'dr-status', 'counts'] as SSEEventType[]) {
      source.addEventListener(type, (evt: MessageEvent) => {
        let payload: any = null
        try {
          payload = evt.data ? JSON.parse(evt.data) : null
        } catch {
          return
        }
        this.listeners
          .filter(listener => listener.type === type)
          .forEach(listener => listener.handler(payload))
      })
    }
  }

  on(type: SSEEventType, handler: SSEEventHandler): () => void {
    const listener: SSEListener = { type, handler }
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(item => item !== listener)
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectAttempts = 0
    this.cleanupSource()
  }

  private cleanupSource() {
    if (this.source) {
      this.source.close()
      this.source = null
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return

    const backoffMs = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempts))
    this.reconnectAttempts += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect(this.connectedUrl)
    }, backoffMs)
  }
}

export const sseClient = new SSEClient()
