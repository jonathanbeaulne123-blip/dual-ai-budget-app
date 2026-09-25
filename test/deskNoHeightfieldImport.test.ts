import {expect,it} from 'vitest';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import ts from 'typescript';

const root=resolve(import.meta.dirname,'../src/harbour/desk');
function sources(folder:string):string[]{
  return readdirSync(folder,{withFileTypes:true}).flatMap(entry=>{
    const path=resolve(folder,entry.name);
    return entry.isDirectory()?sources(path):/\.tsx?$/.test(entry.name)?[path]:[];
  });
}
function target(from:string,specifier:string):string|undefined{
  if(!specifier.startsWith('.'))return undefined;
  const base=resolve(dirname(from),specifier);
  for(const path of [base,`${base}.ts`,`${base}.tsx`,resolve(base,'index.ts'),resolve(base,'index.tsx')])if(existsSync(path)&&/\.tsx?$/.test(path))return path;
  return undefined;
}
it('keeps every runtime import below the flat Desk clear of mountain and Horizon terrain',()=>{
  const seen=new Set<string>();
  const visit=(file:string)=>{
    if(seen.has(file))return;
    seen.add(file);
    const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,extname(file)==='.tsx'?ts.ScriptKind.TSX:ts.ScriptKind.TS);
    for(const node of source.statements){
      if(ts.isImportDeclaration(node)){
        const clause=node.importClause;
        if(clause?.isTypeOnly)continue;
        if(clause?.namedBindings&&ts.isNamedImports(clause.namedBindings)&&!clause.name&&clause.namedBindings.elements.every(element=>element.isTypeOnly))continue;
      }else if(!ts.isExportDeclaration(node)||node.isTypeOnly)continue;
      const specifier=node.moduleSpecifier;
      if(!specifier||!ts.isStringLiteral(specifier))continue;
      const dependency=target(file,specifier.text);
      if(dependency)visit(dependency);
    }
  };
  sources(root).forEach(visit);
  const forbidden=[...seen].filter(path=>/\/src\/harbour\/(mountain|horizon)\/|\/public\/.*\/terrain\//.test(path));
  expect(forbidden).toEqual([]);
});
