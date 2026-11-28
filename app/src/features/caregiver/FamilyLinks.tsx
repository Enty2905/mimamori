import React from 'react';
import {View,Alert} from 'react-native';
import {useMutation} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {useFamily} from './queries';
import {useAuthStore} from '../../core/auth/useAuthStore';
import {careApi} from '../../core/api/careApi';
import {queryClient} from '../../core/api/queryClient';
import {Button,Body,Notice} from '../../components/CareUI';
export function FamilyLinks() {
  const family=useFamily(); const role=useAuthStore(state=>state.role);const {t}=useTranslation();
  const change=useMutation({mutationFn:({id,accept}:{id:number;accept:boolean})=>accept?careApi.acceptLink(id):careApi.unlink(id),onSuccess:()=>{queryClient.removeQueries({queryKey:['overview']});void queryClient.invalidateQueries({queryKey:['family']});void queryClient.invalidateQueries({queryKey:['doses']});}});
  return <View style={{gap:12,padding:20}}>
    {family.isPending && <Notice text={t('loading')} />}
    {family.isError && <><Notice tone="danger" text={t('error')} /><Button title={t('retry')} onPress={()=>{void family.refetch();}} /></>}
    {family.data?.map(item=><View key={item.relationshipId} style={{gap:12,paddingVertical:12}}>
      <Body>{item.member.fullName}</Body><Body size={18}>{t(item.status==='ACCEPTED'?'connected':'pendingLink')}</Body>
      {role==='ELDERLY' && item.status==='PENDING' && <Button title={t('acceptLink')} busy={change.isPending} onPress={()=>change.mutate({id:item.relationshipId,accept:true})} />}
      <Button variant="secondary" title={t('unlink')} disabled={change.isPending} onPress={()=>Alert.alert(t('unlink'),t('unlinkHelp'),[{text:t('cancel'),style:'cancel'},{text:t('unlink'),style:'destructive',onPress:()=>change.mutate({id:item.relationshipId,accept:false})}])} />
    </View>)}
    {family.data?.length===0 && <Body>{t('noFamily')}</Body>}
    {change.isError && <Notice tone="danger" text={t('error')} />}
  </View>;
}
