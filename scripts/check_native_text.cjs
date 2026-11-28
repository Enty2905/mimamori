// React Native rejects even a whitespace-only JSX child when it is outside Text.
const fs=require('node:fs'),path=require('node:path');
const ts=require('../app/node_modules/typescript');
const root=path.resolve(__dirname,'../app/src');let failures=0;
function clean(value){return value.split(/\r?\n/).map((line,i,all)=>{line=line.replace(/\t/g,' ');if(i)line=line.replace(/^ +/,'');if(i!==all.length-1)line=line.replace(/ +$/,'');return line;}).filter(Boolean).join(' ');}
function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,entry.name);if(entry.isDirectory()){scan(file);continue;}
 if(!file.endsWith('.tsx')||file.includes('.test.'))continue;
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 function visit(node){if(ts.isJsxText(node)&&clean(node.text).length){
   let parent=node.parent;while(parent&&ts.isJsxFragment(parent))parent=parent.parent;
   const tag=parent&&ts.isJsxElement(parent)?parent.openingElement.tagName.getText(source):'';
   if(!['Text','CareText','Body','Heading'].includes(tag)){
     const line=source.getLineAndCharacterOfPosition(node.getStart(source)).line+1;
     console.error(`${path.relative(root,file)}:${line}: raw JSX text outside a native Text component`);failures++;
   }
 }ts.forEachChild(node,visit);}visit(source);
}}
scan(root);if(failures)process.exitCode=1;else console.log('Native JSX text check passed.');
