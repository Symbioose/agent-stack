import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';

// react-bits-style staggered text reveal powered by GSAP.
export default function SplitText({ text, className }: { text: string; className?: string }) {
  const rootRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const words = root.querySelectorAll('[data-word]');
    const tween = gsap.fromTo(
      words,
      { opacity: 0, y: 14, filter: 'blur(6px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.55, stagger: 0.055, ease: 'power3.out' },
    );
    return () => {
      tween.kill();
    };
  }, [text]);

  return (
    <span ref={rootRef} className={className} aria-label={text}>
      {text.split(' ').map((word, index) => (
        <span key={index} aria-hidden="true" data-word className="inline-block whitespace-pre">
          {word}
          {index < text.split(' ').length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  );
}
