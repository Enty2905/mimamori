import React from 'react';
import {render} from '@testing-library/react-native';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {ElderlyMedicationScreen} from './ElderlyMedicationScreen';
jest.mock('../../core/auth/useSession',()=>({useSession:()=>({role:'ELDERLY',userId:1})}));
jest.mock('../caregiver/queries',()=>({useSelectedElderly:()=>({id:undefined})}));
jest.mock('../medication/queries',()=>({useDoseList:()=>({isError:true,isPending:false,isRefetching:false,data:undefined,refetch:jest.fn()})}));
test('failed schedule does not show empty or healthy adherence states',async()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});
  const view=await render(<QueryClientProvider client={client}><ElderlyMedicationScreen /></QueryClientProvider>);
  expect(view.getByText('Không thể tải lịch thuốc. Vui lòng thử lại.')).toBeTruthy();
  expect(view.queryByText('Hôm nay chưa có lịch thuốc')).toBeNull();
  expect(view.queryByText(/100%|Rất tốt|72 nhịp|3,200/)).toBeNull();
  expect(view.getByRole('button',{name:'Thử lại'})).toBeTruthy();
  await view.unmount();client.clear();
});
