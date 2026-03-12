import { getSyncStatusLabel } from '../../offline/utils';
import type { OfflineSyncStatus } from '../../offline/types';
import './sync-status-badge.css';

export function SyncStatusBadge({
  status,
  queuedCount,
}: {
  status: OfflineSyncStatus;
  queuedCount?: number;
}) {
  return (
    <span className={`sync-status-badge sync-status-badge--${status}`}>
      {getSyncStatusLabel(status)}
      {queuedCount && queuedCount > 0 ? ` (${queuedCount})` : ''}
    </span>
  );
}

