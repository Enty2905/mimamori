import {create} from 'zustand';
import Storage from 'expo-sqlite/kv-store';
import {colors, darkColors} from './colors';
import {useAccessibilityStore} from '../accessibility/useAccessibilityStore';
import {useAuthStore} from '../auth/useAuthStore';
type Preferences={darkMode:boolean;highContrast:boolean};
const defaults:Preferences={darkMode:false,highContrast:false};
export const useThemeStore=create<Preferences & {set:(values:Partial<Preferences>)=>void;load:()=>void}>((set,get)=>({
  ...defaults,
  set:values=>{set(values);const state=get();Storage.setItemSync('mimamori.display',JSON.stringify({darkMode:state.darkMode,highContrast:state.highContrast}));},
  load:()=>{try {const value=JSON.parse(Storage.getItemSync('mimamori.display')??'{}') as Partial<Preferences>;set({darkMode:value.darkMode===true,highContrast:value.highContrast===true});}catch{set(defaults);}},
}));
const dark:typeof colors={...colors,background:'#17251E',surface:'#21352B',surfaceWarm:'#293D31',surfaceMuted:'#304638',primary:'#B0D0B9',primaryDark:'#C5E0CD',primaryLight:'#334D3D',textPrimary:'#F8F5EF',textSecondary:'#D2DDD4',textMuted:'#B9CABC',textInverse:'#17251E',border:'#63816B',borderLight:'#506858',divider:'#506858',success:'#293E30',successText:'#C0E7CC',danger:'#482E2B',dangerText:'#FFC5BB',warning:'#423A29',warningText:'#FFE1A8',cardBorder:'#63816B',dangerLight:'#482E2B',successLight:'#293E30',warningLight:'#423A29'};
const high:typeof colors={...colors,textPrimary:'#16251C',textSecondary:'#273C2F',textMuted:'#344E3C',border:'#637C6A',borderLight:'#718779'};
const darkHigh:typeof colors={...dark,textPrimary:'#FFFFFF',textSecondary:'#FFFFFF',textMuted:'#F0F7F1',border:'#BDD1C1'};
export function useColors(){
  const preferences=useThemeStore();
  const role=useAuthStore(state=>state.role);
  if (!preferences.darkMode) return preferences.highContrast ? high : colors;
  if (preferences.highContrast) return darkHigh;
  return role === 'CAREGIVER' ? darkColors : dark;
}

export function useCaregiverTheme() {
  const isDark = useThemeStore(state => state.darkMode);
  const set = useThemeStore(state => state.set);
  const fs = useAccessibilityStore(state => state.fs);
  return { isDark, c: useColors(), fs, setCaregiverDarkMode: (darkMode: boolean) => set({darkMode}) };
}
