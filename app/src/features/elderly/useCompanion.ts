import {useEffect, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import {conversationApi, ChatMessage} from '../../core/api/conversationApi';
import {useAuthStore} from '../../core/auth/useAuthStore';
import {queryClient} from '../../core/api/queryClient';

export function useCompanion() {
  const owner = useAuthStore(state=>state.userId);
  const active = useQuery({queryKey:['conversation',owner],enabled:owner!==null,queryFn:({signal})=>conversationApi.active(signal)});
  const id = active.data?.id;
  const history = useQuery({queryKey:['messages',owner,id],enabled:!!id,queryFn:({signal})=>conversationApi.messages(id!,signal)});
  const [sending,setSending] = useState(false);
  const [draft,setDraft] = useState<ChatMessage[]>([]);
  const [error,setError] = useState(false);
  const flight = useRef<AbortController | null>(null);
  const retry = useRef<{text:string;id:string} | null>(null);
  useEffect(()=>()=>{flight.current?.abort();},[owner]);
  async function send(text:string) {
    if(!id || flight.current || !text.trim()) return false;
    const controller = new AbortController(); flight.current=controller;
    const requestId = retry.current?.text===text ? retry.current.id : Crypto.randomUUID();
    retry.current={text,id:requestId};
    setSending(true);setError(false);
    const user:ChatMessage={id:-1,sender:'USER',content:text,createdAt:new Date().toISOString()};
    setDraft([user]);
    let partial='';
    try {
      await conversationApi.stream(id,text,requestId,delta=>{
        partial+=delta;
        setDraft([user,{id:-2,sender:'AI',content:partial,createdAt:user.createdAt}]);
      },controller.signal);
      await queryClient.invalidateQueries({queryKey:['messages',owner,id]});
      retry.current=null;setDraft([]);
      return true;
    } catch {
      setError(true);setDraft([]);
      await history.refetch();
      return false;
    } finally {flight.current=null;setSending(false);}
  }
  return {conversation:active.data, messages:[...(history.data??[]),...draft], sending,
    loading:active.isPending || (!!id && history.isPending), error:error || active.isError || history.isError,
    reload:()=>{void active.refetch();void history.refetch();}, send, cancel:()=>flight.current?.abort()};
}
