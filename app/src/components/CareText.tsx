import React from 'react';
import {Text as NativeText,TouchableOpacity,StyleSheet,TextProps} from 'react-native';
import {useColors} from '../core/theme/useTheme';
import {useAccessibilityStore} from '../core/accessibility/useAccessibilityStore';
export function CareText({style,...props}:TextProps){
  const colors=useColors();
  const scale=useAccessibilityStore(state=>state.fontScale);
  const flattened=StyleSheet.flatten(style);
  const fontSize=Math.max(flattened?.fontSize??20,18*scale);
  return <NativeText {...props} allowFontScaling style={[{color:colors.textPrimary},style,{fontSize,lineHeight:Math.ceil(fontSize*1.4),flexShrink:1}]} />;
}
export function CareTouchable({style,...props}:React.ComponentProps<typeof TouchableOpacity>){
  return <TouchableOpacity accessibilityRole="button" {...props} style={[style,{minHeight:56,minWidth:56}]} />;
}
