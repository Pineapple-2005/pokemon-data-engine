'use client';

import React, { useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { ChatMessage } from '@/types';

const OAK_SPRITE = 'https://play.pokemonshowdown.com/sprites/trainers/oak.png';

const SUGGESTED = [
  'Who is the best sweeper?',
  'Which Pokemon counters Psychic types?',
  'Build me a balanced team',
  'What are the fastest Pokemon?',
];

function PokeBallIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="20" cy="20" r="18" fill="none" stroke="#555" strokeWidth="2" />
      <path d="M2 20 A18 18 0 0 1 38 20" fill="#DC2626" />
      <path d="M38 20 A18 18 0 0 1 2 20" fill="#e8e8e8" />
      <line x1="2" y1="20" x2="38" y2="20" stroke="#333" strokeWidth="2.5" />
      <circle cx="20" cy="20" r="5" fill="#333" />
      <circle cx="20" cy="20" r="2.8" fill="#e8e8e8" />
    </svg>
  );
}

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: "Ah, a trainer! Welcome to my laboratory. I have studied Pokemon for many years. What would you like to know about Gen 1 Pokemon?",
};

export default function Engine6Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function sendMessage(question: string) {
    if (!question.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const res = await api.chatWithOak(question);
      const oakMsg: ChatMessage = { role: 'assistant', content: res.answer, sources: res.sources };
      setMessages((prev) => [...prev, oakMsg]);
    } catch {
      const errMsg: ChatMessage = { role: 'assistant', content: "Hmm, it seems my research data is temporarily unavailable. Please try again, Trainer." };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  return (
    <div className="pk-section">

      {/* Header */}
      <header style={{ marginBottom: 'clamp(1.25rem, 3vw, 1.75rem)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-red)', letterSpacing: '0.12em' }}>
            ENGINE 06 | RAG
          </span>
        </div>
        <h1 style={{ margin: '0 0 0.3rem', fontSize: 'clamp(1.3rem,3vw,2rem)', fontWeight: 900, color: 'var(--pk-text)' }}>
          The Pokedex AI
        </h1>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--pk-text-muted)' }}>
          Ask Professor Oak anything about Gen 1 Pokemon.
        </p>
      </header>

      {/* Lab layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '1.25rem', alignItems: 'start' }}>

        {/* Professor Oak panel */}
        <div style={{
          background: '#0a0e1a',
          border: '1px solid rgba(120,200,80,0.2)',
          borderRadius: '0.875rem',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem',
          position: 'sticky',
          top: '1rem',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={OAK_SPRITE}
            alt="Professor Oak"
            width={120}
            height={120}
            style={{ imageRendering: 'pixelated', width: '120px', height: 'auto', objectFit: 'contain' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.46rem', fontFamily: 'var(--font-pixel)', color: '#78C850', letterSpacing: '0.08em' }}>
              PROF. OAK
            </p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.65rem', color: 'var(--pk-text-muted)', lineHeight: 1.4 }}>
              Pokemon Research Lab
            </p>
          </div>
          <div style={{ width: '100%', height: '1px', background: 'rgba(120,200,80,0.15)' }} />
          <div>
            <p style={{ margin: '0 0 0.4rem', fontSize: '0.38rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', letterSpacing: '0.06em' }}>
              TRY ASKING:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => { void sendMessage(q); }}
                  disabled={loading}
                  style={{
                    background: 'rgba(120,200,80,0.06)',
                    border: '1px solid rgba(120,200,80,0.2)',
                    borderRadius: '0.35rem',
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.65rem',
                    color: 'rgba(120,200,80,0.8)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    lineHeight: 1.3,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chat panel */}
        <div style={{
          background: '#0a0e1a',
          border: '1px solid rgba(120,200,80,0.15)',
          borderRadius: '0.875rem',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '520px',
        }}>
          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            maxHeight: '60vh',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.875rem',
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                gap: '0.5rem',
                alignItems: 'flex-end',
              }}>
                {msg.role === 'assistant' && <PokeBallIcon size={18} />}
                <div style={{ maxWidth: '75%' }}>
                  <div style={{
                    padding: '0.75rem 1rem',
                    borderRadius: msg.role === 'user' ? '0.75rem 0.75rem 0.2rem 0.75rem' : '0.75rem 0.75rem 0.75rem 0.2rem',
                    background: msg.role === 'user' ? 'rgba(239,68,68,0.12)' : 'rgba(120,200,80,0.07)',
                    border: msg.role === 'user' ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(120,200,80,0.15)',
                    fontSize: '0.875rem',
                    color: 'var(--pk-text)',
                    lineHeight: 1.7,
                  }}>
                    {msg.content}
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <p style={{ margin: '0.3rem 0 0 0.25rem', fontSize: '0.65rem', color: 'var(--pk-text-muted)' }}>
                      Sources: {msg.sources.slice(0, 5).join(', ')}{msg.sources.length > 5 ? '...' : ''}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PokeBallIcon size={18} />
                <div style={{
                  padding: '0.6rem 1rem',
                  background: 'rgba(120,200,80,0.07)',
                  border: '1px solid rgba(120,200,80,0.15)',
                  borderRadius: '0.75rem',
                  fontSize: '0.55rem',
                  fontFamily: 'var(--font-pixel)',
                  color: '#78C850',
                  letterSpacing: '0.06em',
                }}>
                  OAK IS THINKING...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '0.875rem',
            borderTop: '1px solid rgba(120,200,80,0.1)',
            display: 'flex',
            gap: '0.625rem',
          }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Professor Oak about Gen 1 Pokemon..."
              disabled={loading}
              className="pk-input"
              style={{ flex: 1, fontSize: '16px' }}
            />
            <button
              type="button"
              onClick={() => { void sendMessage(input); }}
              disabled={!input.trim() || loading}
              style={{
                padding: '0.5rem 1.25rem',
                background: !input.trim() || loading ? 'rgba(255,255,255,0.04)' : 'rgba(120,200,80,0.15)',
                border: '1px solid rgba(120,200,80,0.35)',
                borderRadius: '0.5rem',
                color: '#78C850',
                fontFamily: 'var(--font-pixel)',
                fontSize: '0.52rem',
                letterSpacing: '0.06em',
                cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                opacity: !input.trim() || loading ? 0.45 : 1,
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              SEND
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
