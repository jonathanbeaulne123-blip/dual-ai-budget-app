import{it,expect,vi,beforeEach}from'vitest';
const api=vi.hoisted(()=>({countTokens:vi.fn(),generateContent:vi.fn()}));
vi.mock('@google/genai',()=>({GoogleGenAI:class{models=api},ThinkingLevel:{LOW:'LOW',MEDIUM:'MEDIUM',HIGH:'HIGH'}}));
import{callFlash,assertWorkspaceProviderPolicy}from'../workers/workspace/provider.ts';import{FLASH_MODEL}from'../src/workspace/runtime.ts';
const env={HERCULES_WORKSPACE_EXECUTION:'true',HERCULES_WORKSPACE_MODEL:FLASH_MODEL,HERCULES_WORKSPACE_DATA:'synthetic',GEMINI_API_KEY:'synthetic-test-key'};
beforeEach(()=>{api.countTokens.mockReset().mockResolvedValue({totalTokens:720});api.generateContent.mockReset().mockResolvedValue({candidates:[{content:{role:'model',parts:[{functionCall:{id:'call',name:'calculate',args:{operation:'sum',values:[2,3]}},thoughtSignature:'retained-signature'}]}}],usageMetadata:{promptTokenCount:720,candidatesTokenCount:20,thoughtsTokenCount:40}});});
it('pins Flash, counts the full tool-bearing context, reserves before generation and retains native signatures',async()=>{
 const order:string[]=[];api.generateContent.mockImplementationOnce(async()=>{order.push('generate');return{candidates:[{content:{role:'model',parts:[{text:'Ready',thoughtSignature:'retained-signature'}]}}],usageMetadata:{promptTokenCount:720,candidatesTokenCount:20,thoughtsTokenCount:40}}});
 const result=await callFlash(env,[{role:'user',parts:[{text:'A synthetic lesson'}]}],'high',8192,async(input,output)=>{expect(input).toBe(720);expect(output).toBe(8192);order.push('reserve');});
 expect(order).toEqual(['reserve','generate']);expect(api.countTokens.mock.calls[0]![0].config.tools[0].functionDeclarations.length).toBeGreaterThan(5);expect(api.generateContent.mock.calls[0]![0]).toMatchObject({model:FLASH_MODEL,config:{thinkingConfig:{thinkingLevel:'HIGH'}}});expect(result.content.parts[0]?.thoughtSignature).toBe('retained-signature');expect(result.outputTokens).toBe(60);
});
it('does not generate after a budget or token-count refusal',async()=>{
 await expect(callFlash(env,[],'low',8000,async()=>{throw Error('RUN_BUDGET_EXCEEDED')})).rejects.toThrow('RUN_BUDGET_EXCEEDED');expect(api.generateContent).not.toHaveBeenCalled();
 api.countTokens.mockResolvedValueOnce({});await expect(callFlash(env,[],'low',8000,async()=>{})).rejects.toThrow('TOKEN_COUNT_UNAVAILABLE');expect(api.generateContent).not.toHaveBeenCalled();
});
it('requires the separate disclosure policy for meaningful context and never substitutes a model',()=>{
 expect(()=>assertWorkspaceProviderPolicy(env,true)).toThrow('DISCLOSURE_NOT_ACTIVATED');expect(()=>assertWorkspaceProviderPolicy({...env,HERCULES_WORKSPACE_MODEL:'another-provider'},false)).toThrow('UNTESTED_MODEL_CONFIGURATION');expect(()=>assertWorkspaceProviderPolicy({...env,GEMINI_API_KEY:''},false)).toThrow('FLASH_UNAVAILABLE');
});
