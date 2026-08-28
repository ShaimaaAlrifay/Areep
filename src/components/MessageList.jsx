import { useEffect, useRef } from 'react'
import { Message } from './Message'

export function MessageList({ messages }) {
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  if (messages.length === 0) return null

  return (
    <div className="message-list">
      {messages.map((message) => (
        <Message key={message.id} role={message.role} content={message.content} />
      ))}
      <div ref={endRef} />
    </div>
  )
}
