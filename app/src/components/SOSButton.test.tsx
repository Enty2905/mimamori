import React from 'react';
import {Alert} from 'react-native';
import {render,fireEvent} from '@testing-library/react-native';
import {SOSButton} from './SOSButton';
import {careApi} from '../core/api/careApi';
jest.mock('../core/api/careApi',()=>({careApi:{emergency:jest.fn()}}));
beforeEach(()=>{jest.mocked(careApi.emergency).mockReset();jest.spyOn(Alert,'alert').mockImplementation(()=>{});});
afterEach(()=>jest.restoreAllMocks());
test('failed SOS stays visible, offers retry and never announces success',async()=>{
  jest.mocked(careApi.emergency).mockRejectedValue(new Error('offline'));
  const view=await render(<SOSButton />);
  await fireEvent.press(view.getByRole('button',{name:'Tôi cần trợ giúp'}));
  await fireEvent.press(view.getByRole('button',{name:'Gửi yêu cầu trợ giúp'}));
  expect(await view.findByText(/Chưa gửi được yêu cầu/)).toBeTruthy();
  expect(Alert.alert).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole('button',{name:'Thử gửi lại yêu cầu'}));
  expect(careApi.emergency).toHaveBeenCalledTimes(2);
  expect(jest.mocked(careApi.emergency).mock.calls[0][0]).toBe(jest.mocked(careApi.emergency).mock.calls[1][0]);
});
test('server receipt explicitly says device delivery is unconfirmed',async()=>{
  jest.mocked(careApi.emergency).mockResolvedValue({requestId:'synthetic',status:'RECORDED',recipientCount:1});
  const view=await render(<SOSButton />);
  await fireEvent.press(view.getByRole('button',{name:'Tôi cần trợ giúp'}));
  await fireEvent.press(view.getByRole('button',{name:'Gửi yêu cầu trợ giúp'}));
  expect(Alert.alert).toHaveBeenCalledWith(expect.any(String),expect.stringContaining('Chưa thể xác nhận họ đã nhận thông báo'));
});
