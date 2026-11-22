import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Mimamori AI',
  slug: 'mimamori',
  version: '0.1.0',
  orientation: 'portrait',
  platforms: ['android', 'ios'],
  scheme: 'mimamori',
  userInterfaceStyle: 'automatic',
  icon: './assets/images/icon.png',
  ios: {
    bundleIdentifier: 'com.mimamori.app',
    icon: './assets/expo.icon',
    supportsTablet: true,
    infoPlist: {
      NSMicrophoneUsageDescription:
        'Mimamori AI cần quyền sử dụng micro để lắng nghe và trò chuyện bằng giọng nói cùng ông/bà.',
      NSSpeechRecognitionUsageDescription:
        'Mimamori AI cần quyền nhận dạng giọng nói để chuyển lời nói tiếng Việt thành văn bản cho ông/bà.',
      NSCameraUsageDescription:
        'Mimamori AI cần quyền sử dụng máy ảnh để chụp ảnh hộp thuốc hoặc đơn thuốc giúp ông/bà hỏi trợ lý AI.',
      NSPhotoLibraryUsageDescription:
        'Mimamori AI cần quyền truy cập thư viện ảnh để ông/bà chọn ảnh hộp thuốc hoặc đơn thuốc gửi trợ lý AI.',
    },
  },
  android: {
    package: 'com.mimamori.app',
    permissions: ['android.permission.RECORD_AUDIO', 'android.permission.CAMERA'],
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    '@react-native-firebase/app',
    '@react-native-firebase/messaging',
    '@react-native-firebase/crashlytics',
    [
      'expo-speech-recognition',
      {
        microphonePermission:
          'Mimamori AI cần quyền sử dụng micro để lắng nghe và trò chuyện bằng giọng nói cùng ông/bà.',
        speechRecognitionPermission:
          'Mimamori AI cần quyền nhận dạng giọng nói để chuyển lời nói tiếng Việt thành văn bản cho ông/bà.',
      },
    ],
    [
      'expo-audio',
      {
        microphonePermission:
          'Mimamori AI cần quyền sử dụng micro để thu âm giọng nói khi trò chuyện cùng trợ lý.',
        recordAudioAndroid: true,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Mimamori AI cần quyền truy cập thư viện ảnh để ông/bà chọn ảnh hộp thuốc hoặc đơn thuốc gửi trợ lý AI.',
        cameraPermission:
          'Mimamori AI cần quyền sử dụng máy ảnh để chụp ảnh hộp thuốc hoặc đơn thuốc giúp ông/bà hỏi trợ lý AI.',
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#F8F5EF',
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
