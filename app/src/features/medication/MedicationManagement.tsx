import React, {useState} from 'react';
import {View, Modal, Alert} from 'react-native';
import {useQuery, useMutation} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {careApi, Medication} from '../../core/api/careApi';
import {queryClient} from '../../core/api/queryClient';
import {Body, Button, Notice} from '../../components/CareUI';
import {MedicationForm} from './MedicationForm';
export function MedicationManagement({elderlyId}: {elderlyId?: number}) {
  const {t} = useTranslation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Medication>();
  const list = useQuery({queryKey: ['medications',elderlyId], enabled: !!elderlyId && open, queryFn: () => careApi.medications(elderlyId)});
  const stop = useMutation({mutationFn: careApi.stopMedication, onSuccess: () => {void queryClient.invalidateQueries({queryKey:['medications']}); void queryClient.invalidateQueries({queryKey:['doses']});}});
  return <View style={{padding:20, gap:12}}>
    <Button variant="secondary" title={t('manageMedications')} disabled={!elderlyId} onPress={() => setOpen(!open)} />
    {open && list.isError && <><Notice tone="danger" text={t('error')} /><Button title={t('retry')} onPress={() => {void list.refetch();}} /></>}
    {open && list.data?.map(item => <View key={item.id} style={{gap:12,paddingVertical:12}}>
      <Body>{item.name} · {item.dosage}</Body>
      <Button variant="secondary" title={t('edit')} onPress={() => setEditing(item)} />
      <Button variant="danger" title={t('stopMedication')} busy={stop.isPending} onPress={() => Alert.alert(t('stopMedication'), t('stopConfirm'), [{text:t('cancel'),style:'cancel'}, {text:t('stopMedication'),style:'destructive',onPress:()=>stop.mutate(item.id)}])} />
    </View>)}
    {stop.isError && <Notice tone="danger" text={t('error')} />}
    <Modal visible={!!editing} onRequestClose={() => setEditing(undefined)} animationType="slide">
      {editing && <MedicationForm elderlyId={elderlyId} medication={editing} onClose={() => setEditing(undefined)} />}
    </Modal>
  </View>;
}
