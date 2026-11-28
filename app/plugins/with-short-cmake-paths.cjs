const { withGradleProperties, withAppBuildGradle } = require('expo/config-plugins');

// SDK 58 defaults to 1024, but Windows' bundled Ninja needs hashed paths.
// Use Expo's property so the setting reaches both the app and native modules.
module.exports = function withShortCmakePaths(config) {
  config = withGradleProperties(config, (result) => {
    const key = 'expo.android.cmakeObjectPathMax';
    result.modResults = result.modResults.filter((entry) => entry.key !== key);
    result.modResults.push({ type: 'property', key, value: '240' });
    return result;
  });
  return withAppBuildGradle(config, (result) => {
    const marker = '// Mimamori short native staging directory';
    if (!result.modResults.contents.includes(marker)) {
      result.modResults.contents += `
${marker}
android.externalNativeBuild.cmake.buildStagingDirectory = new File(rootProject.projectDir, '../../.cxx')
`;
    }
    const limitMarker = '// Mimamori app CMake object limit';
    if (!result.modResults.contents.includes(limitMarker)) {
      result.modResults.contents += `
${limitMarker}
android.defaultConfig.externalNativeBuild.cmake.arguments.add('-DCMAKE_OBJECT_PATH_MAX=250')
`;
    }
    return result;
  });
};
