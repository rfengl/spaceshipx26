import { useState } from 'react';

import PassengerFormModal from './PassengerFormModal';
import type { Passenger } from '../../types';

interface Props {
  onCreated: (passenger: Passenger) => void;
}

/** The "+ Add passenger" button — self-contained: owns its create modal. */
export default function AddPassengerButton({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>
        + Add passenger
      </button>
      {open && <PassengerFormModal onClose={() => setOpen(false)} onSaved={onCreated} />}
    </>
  );
}
