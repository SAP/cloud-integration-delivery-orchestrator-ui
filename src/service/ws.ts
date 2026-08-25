type WSEventType = 'dr-updated'
type WSEventHandler = (data: any) => void

interface WSListener {
  type: WSEventType
  handler: WSEventHandler
}

interface WSMessage {
  event: WSEventType
  data: any
}

class WSClient {
  private ws: WebSocket | null = null
  private listeners: WSListener[] = []
  private subscriptions: Set<number> = new Set()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private closed = false

  connect() {
    if (this.ws) return
    this.closed = false

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${location.host}/api/v1/ws`

    const ws = new WebSocket(url)
    this.ws = ws

    ws.onopen = () => {
      this.reconnectAttempts = 0
      console.log('[WS] connected')
      // Re-subscribe all previously held subscriptions after reconnect
      for (const drId of this.subscriptions) {
        this.sendSubscribe(drId)
      }
    }

    ws.onmessage = (evt: MessageEvent) => {
      let msg: WSMessage
      try {
        msg = JSON.parse(evt.data)
      } catch {
        return
      }
      console.log('[WS] received:', msg.event, msg.data)
      this.listeners
        .filter(l => l.type === msg.event)
        .forEach(l => l.handler(msg.data))
    }

    ws.onclose = () => {
      console.log('[WS] disconnected', this.closed ? '(intentional)' : '(will reconnect)')
      this.ws = null
      if (!this.closed) {
        this.scheduleReconnect()
      }
    }

    ws.onerror = () => {
      // onclose will fire after onerror, triggering reconnect
    }
  }

  disconnect() {
    this.closed = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectAttempts = 0
    this.subscriptions.clear()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  subscribe(drId: number) {
    console.log('[WS] subscribe drId=', drId)
    this.subscriptions.add(drId)
    this.sendSubscribe(drId)
  }

  unsubscribe(drId: number) {
    console.log('[WS] unsubscribe drId=', drId)
    this.subscriptions.delete(drId)
    this.sendUnsubscribe(drId)
  }

  on(type: WSEventType, handler: WSEventHandler): () => void {
    const listener: WSListener = { type, handler }
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(item => item !== listener)
    }
  }

  private sendSubscribe(drId: number) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'subscribe', drId }))
    }
  }

  private sendUnsubscribe(drId: number) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'unsubscribe', drId }))
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    const backoffMs = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempts))
    this.reconnectAttempts += 1
    console.log(`[WS] reconnecting in ${backoffMs}ms (attempt ${this.reconnectAttempts})`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, backoffMs)
  }
}

export const wsClient = new WSClient()
