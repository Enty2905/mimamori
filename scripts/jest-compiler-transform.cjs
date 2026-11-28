const babel = require('../app/node_modules/babel-jest');
const preset = require.resolve('../app/node_modules/babel-preset-expo');
const normal = babel.createTransformer({presets:[preset]});
const compiled = babel.createTransformer({presets:[preset],caller:{name:'babel-jest',platform:'android',isDev:true,bundler:'metro',supportsReactCompiler:true}});
module.exports = {process(source,filename,options){
  const ownSource = filename.replaceAll('\\','/').includes('/app/src/');
  return (ownSource ? compiled : normal).process(source,filename,options);
}};
