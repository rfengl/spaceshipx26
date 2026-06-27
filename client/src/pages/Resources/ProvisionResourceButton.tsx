import { useState } from 'react';

import ResourceFormModal from './ResourceFormModal';
import type { Resource } from '../../types';

interface Props {
  onCreated: (resource: Resource) => void;
}

/** The "+ Provision" header button — self-contained: owns its create modal. */
export default function ProvisionResourceButton({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>
        + Provision
      </button>
      {open && <ResourceFormModal onClose={() => setOpen(false)} onSaved={onCreated} />}
    </>
  );
}
