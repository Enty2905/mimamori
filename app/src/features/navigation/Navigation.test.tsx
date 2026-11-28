import React from 'react';
import {render,fireEvent,act} from '@testing-library/react-native';
import {QueryClientProvider} from '@tanstack/react-query';
import {MainShell} from './MainShell';
import {queryClient} from '../../core/api/queryClient';
import {useAuthStore} from '../../core/auth/useAuthStore';
import {careApi} from '../../core/api/careApi';
import {SafeAreaProvider} from 'react-native-safe-area-context';
const user={id:1,username:'test_elder',fullName:'Synthetic Elder',email:'test@example.invalid',role:'ELDERLY' as const};
jest.mock('../../core/api/careApi',()=>({careApi:{profile:jest.fn(),family:jest.fn(),overview:jest.fn(),alerts:jest.fn(async()=>[]),today:jest.fn(async()=>[]),history:jest.fn(async()=>[]),todayCheckin:jest.fn(async()=>null),medications:jest.fn(async()=>[])}}));
jest.mock('../../core/api/conversationApi',()=>({conversationApi:{active:jest.fn(async()=>({id:1,title:'Test'})),messages:jest.fn(async()=>[])}}));
jest.mock('../../core/storage/medicationStore',()=>({cachedDoses:jest.fn(async()=>null),cacheDoses:jest.fn(async()=>{}),queuedConfirmations:jest.fn(async()=>[])}));
jest.mock('../../core/notifications/runtime',()=>({useReminderStatus:()=>({status:'off',enable:jest.fn()})}));
beforeEach(()=>{
  queryClient.clear();queryClient.setDefaultOptions({queries:{retry:false,staleTime:Infinity,gcTime:Infinity},mutations:{gcTime:Infinity}});
  jest.mocked(careApi.profile).mockResolvedValue(user);
  jest.mocked(careApi.family).mockResolvedValue([]);
  queryClient.setQueryData(['profile',1],user);
  useAuthStore.setState({userId:1,role:'ELDERLY',ready:true,restore:async()=>{}});
});
test('switches every elderly tab and re-renders medication with the real selection hook',async()=>{
  const view=await render(<SafeAreaProvider initialMetrics={{frame:{x:0,y:0,width:390,height:844},insets:{top:0,bottom:0,left:0,right:0}}}><QueryClientProvider client={queryClient}><MainShell /></QueryClientProvider></SafeAreaProvider>);
  for(const tab of ['Thuốc','Hồ sơ','AI','Điểm danh','Trang chủ','Thuốc']){
    const label=view.getAllByText(tab,{exact:true}).at(-1)!;
    await fireEvent.press(label);
  }
  await act(async()=>{await queryClient.invalidateQueries({queryKey:['family']});});
  expect(view.getByText('Sức khỏe & Thuốc')).toBeTruthy();
  await view.unmount();queryClient.clear();
});
test('switches caregiver tabs after an owner change without retaining the prior selection',async()=>{
  const caregiver={...user,id:7,role:'CAREGIVER' as const,fullName:'Synthetic Care'};
  const member={...user,id:2};
  jest.mocked(careApi.profile).mockResolvedValue(caregiver);
  jest.mocked(careApi.family).mockResolvedValue([{relationshipId:1,member,status:'ACCEPTED'}]);
  jest.mocked(careApi.overview).mockResolvedValue({elderly:member,careStatus:'UNKNOWN',medicationAdherence:null,todayMedications:[],activeAlerts:[]});
  queryClient.setQueryData(['profile',7],caregiver);
  useAuthStore.setState({userId:7,role:'CAREGIVER'});
  const view=await render(<SafeAreaProvider initialMetrics={{frame:{x:0,y:0,width:390,height:844},insets:{top:0,bottom:0,left:0,right:0}}}><QueryClientProvider client={queryClient}><MainShell /></QueryClientProvider></SafeAreaProvider>);
  for(const tab of ['Lịch thuốc','Gia đình','Cảnh báo','Giám sát','Lịch thuốc'])await fireEvent.press(view.getAllByText(tab,{exact:true}).at(-1)!);
  expect(view.getByText('Sức khỏe & Thuốc')).toBeTruthy();
  await view.unmount();queryClient.clear();
});
