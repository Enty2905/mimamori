import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dose } from '../../core/api/contracts';
import { Button, Notice } from '../../components/CareUI';
import { useConfirmDose, useQueuedConfirmations, discardConflict } from './queries';

export function DoseActions({dose}: {dose: Dose}) {
  const {t} = useTranslation();
  const confirm = useConfirmDose();
  const queue = useQueuedConfirmations();
  const pending = queue.data?.find(item => item.occurrence_id === dose.occurrenceId);
  if (dose.canceled) return <Notice text={t('canceled')} />;
  if (dose.status === 'TAKEN' || dose.status === 'SKIPPED') return <Notice tone="success" text={t(dose.status)} />;
  return <>
    {pending ? <Notice tone="warning" text={t(pending.error_code ? 'syncConflict' : 'pendingSync')} /> :
      <Button title={t('confirmTaken')} busy={confirm.isPending} disabled={queue.isPending || queue.isError}
        onPress={() => confirm.mutate(dose)} />}
    {pending?.error_code && <Button variant="secondary" title={t('discardConflict')} onPress={() => { void discardConflict(dose.occurrenceId); }} />}
    {confirm.isError && <Notice tone="danger" text={t('error')} />}
    {confirm.isSuccess && !pending && !confirm.data && <Notice tone="success" text={t('confirmed')} />}
  </>;
}
