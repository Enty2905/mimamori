import {getNativeNotifications} from './nativeNotifications';
const mockIsGo=jest.fn();
jest.mock('expo',()=>({isRunningInExpoGo:()=>mockIsGo()}));
jest.mock('expo-notifications',()=>{throw new Error('Native notification imports must not run in Expo Go');});
test('Expo Go preview never evaluates unsupported native notification modules',()=>{
  mockIsGo.mockReturnValue(true);
  expect(getNativeNotifications()).toBeNull();
});
