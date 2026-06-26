import { useEffect, type ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ title, onClose, children }: Props) {
  // Lock background scroll while the modal is open. The modal can only be
  // dismissed via the close icon or an action button (e.g. Cancel) — not by
  // clicking the backdrop or pressing Escape.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 grid animate-overlayIn place-items-center bg-[rgba(4,6,12,0.7)] p-4 backdrop-blur-sm">
      <div
        className="w-[min(440px,100%)] animate-modalIn rounded-[14px] border border-[rgba(140,170,220,0.2)] bg-[linear-gradient(160deg,#1a2335,#0c1018)] px-[1.4rem] pb-[1.4rem] pt-5 shadow-[0_24px_70px_rgba(0,0,0,0.6)]"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="m-0 text-[1.15rem]">{title}</h3>
          <button
            className="cursor-pointer border-0 bg-transparent px-1 text-2xl leading-none text-[#9fb3d8] hover:text-[#e8eefc]"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
