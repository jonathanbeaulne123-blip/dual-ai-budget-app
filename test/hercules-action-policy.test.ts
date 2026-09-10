import {describe,it,expect} from 'vitest';
import {herculesActionsEnabled} from '../src/core/herculesActionPolicy.ts';
describe('conversational write release boundary',()=>{
 it('permits only explicitly enabled Development writes',()=>{
  expect(herculesActionsEnabled('development','true')).toBe(true);
  for(const environment of ['production','unknown','', 'Development'])expect(herculesActionsEnabled(environment,'true')).toBe(false);
  for(const flag of [undefined,null,false,true,'false','1','TRUE'])expect(herculesActionsEnabled('development',flag)).toBe(false);
 });
});
