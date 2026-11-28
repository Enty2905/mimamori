import React from 'react';
import {render,fireEvent} from '@testing-library/react-native';
import {AuthScreen} from './AuthScreen';
const mockLogin=jest.fn(async()=>true);
jest.mock('../../core/auth/useSession',()=>({useSession:()=>({login:mockLogin,register:jest.fn(),demoLogin:jest.fn(),isLoading:false,error:null,clearError:jest.fn()})}));
test('original login form submits the latest typed values after compiler-safe form updates',async()=>{
  const view=await render(<AuthScreen />);
  await fireEvent.press(view.getByRole('button',{name:'Bắt đầu trải nghiệm Mimamori'}));
  await fireEvent.changeText(view.getByLabelText('Tên đăng nhập *'),'synthetic-user');
  await fireEvent.changeText(view.getByLabelText('Mật khẩu *'),'Synthetic-password!');
  expect(view.getByLabelText('Tên đăng nhập *').props.value).toBe('synthetic-user');
  await fireEvent.press(view.getByTestId('auth-submit'));
  expect(mockLogin).toHaveBeenCalledWith('synthetic-user','Synthetic-password!');
});
