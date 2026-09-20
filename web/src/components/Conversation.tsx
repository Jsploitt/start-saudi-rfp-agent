import { useEffect, useRef, useState } from 'react';
import { SendHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types';

/**
 * The conversation. Left column of the run screen, and the only place the
 * operator types.
 *
 * Long agent messages are clamped and expand on click — the agent's own prose
 * runs to several hundred words and would otherwise push the question it ends
 * with off the screen.
 */
export function Conversation({
  messages,
  placeholder,
  waiting,
  disabled,
  onSend,
  className,
}: {
  messages: ChatMessage[];
  placeholder: string;
  waiting: boolean;
  disabled: boolean;
  onSend(text: string): void;
  className?: string;
}) {
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  /* Scroll the container, not the element. `scrollIntoView` walks up the tree
     and will scroll the whole page when the panel is off-screen, which on a
     phone yanks the status card out of view every time the agent speaks. */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  /* When the agent asks, put the cursor where the answer goes. */
  useEffect(() => {
    if (waiting) boxRef.current?.focus();
  }, [waiting]);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    onSend(t);
  };

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {messages.length === 0 ? (
          <p className="text-sm text-ink-muted">
            The agent will narrate what it is doing here, and ask when the RFP leaves something
            open.
          </p>
        ) : (
          <ol className="flex flex-col gap-4">
            {messages.map((m) => (
              <Message key={m.id} message={m} />
            ))}
          </ol>
        )}
      </div>

      <form
        className={cn(
          'flex items-end gap-2 border-t border-hairline bg-surface px-6 py-4 transition-shadow',
          waiting && 'shadow-[inset_0_2px_0_0_var(--ss-accent)]'
        )}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex-1">
          <label htmlFor="answer" className="sr-only">
            {waiting ? 'Answer the agent' : 'Message the agent'}
          </label>
          <Textarea
            id="answer"
            ref={boxRef}
            rows={2}
            value={text}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
        </div>
        <Button type="submit" disabled={disabled || !text.trim()} aria-label="Send">
          <SendHorizontal aria-hidden="true" />
          <span className="hidden sm:inline">Send</span>
        </Button>
      </form>
    </div>
  );
}

const LONG = 260;

function Message({ message }: { message: ChatMessage }) {
  const [open, setOpen] = useState(false);
  const long = message.text.length > LONG;
  const isYou = message.kind === 'you';
  const isQuestion = message.kind === 'question';

  return (
    <li
      className={cn(
        'animate-fade-up rounded-lg px-4 py-3 text-sm ring-1',
        isYou && 'ml-8 bg-surface-raised text-ink ring-hairline',
        !isYou && 'bg-surface text-ink ring-hairline',
        isQuestion && 'tint-accent ring-[color:var(--ss-accent)]'
      )}
    >
      <p className="mb-1 text-xs font-semibold uppercase tracking-display text-ink-muted">
        {message.who}
      </p>
      <p className={cn('whitespace-pre-wrap', long && !open && 'line-clamp-4')}>{message.text}</p>
      {long ? (
        <button
          type="button"
          className="mt-1.5 text-xs font-semibold text-accent underline underline-offset-2"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? 'Show less' : 'Show all'}
        </button>
      ) : null}
      {isQuestion ? (
        <p className="mt-2 text-xs font-semibold text-ink-muted">↓ answer below</p>
      ) : null}
    </li>
  );
}
