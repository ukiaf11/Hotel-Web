import { useState } from 'react'

import { useUIStore } from '../store/ui'
import { Button, Modal } from './ui'

export function ConfirmDialog() {
  const request = useUIStore((state) => state.confirm)
  const close = useUIStore((state) => state.closeConfirm)
  const [busy, setBusy] = useState(false)

  if (!request) return null

  const run = async () => {
    setBusy(true)
    try {
      await request.onConfirm()
      close()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={close} title={request.title}>
      <div className="stack">
        <p className="small soft">{request.body}</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant={request.danger ? 'danger' : 'primary'} loading={busy} onClick={run}>
            {request.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
