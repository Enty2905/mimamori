import React from 'react';
import {Text} from 'react-native';
import {render,act} from '@testing-library/react-native';
import {changeLanguage} from './i18n';
import {useOriginalLabels} from './original';
import vi from './original-vi.json';
import ja from './original-ja.json';
import {useThemeStore} from '../theme/useTheme';
function Label(){const tr=useOriginalLabels();return <Text>{tr('Điểm danh')}</Text>;}
test('every original Vietnamese display phrase has a Japanese translation',()=>{
  expect(Object.keys(vi).every(key=>key in ja)).toBe(true);
});
test('switching language updates the original interface without restarting it',async()=>{
  await changeLanguage('vi');const view=await render(<Label />);
  expect(view.getByText('Điểm danh')).toBeTruthy();
  await act(async()=>{await changeLanguage('ja');});
  expect(view.getByText('体調')).toBeTruthy();
  await act(async()=>{await changeLanguage('vi');});
});
test('display preferences persist and restore rather than only changing a switch',()=>{
  useThemeStore.getState().set({darkMode:true,highContrast:true});
  useThemeStore.setState({darkMode:false,highContrast:false});
  useThemeStore.getState().load();
  expect(useThemeStore.getState().darkMode).toBe(true);
  expect(useThemeStore.getState().highContrast).toBe(true);
  useThemeStore.getState().set({darkMode:false,highContrast:false});
});
