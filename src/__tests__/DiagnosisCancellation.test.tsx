// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DiagnosisStep from '../components/DiagnosisStep';
import { runAudit } from '../services/auditEngine';
const pending = vi.hoisted(() => [] as Array<{resolve:(value:any)=>void; reject:(error:Error)=>void; options:any}>);
vi.mock('../contracts/llm', async (original) => ({
  ...await original<typeof import('../contracts/llm')>(),
  runStructuredDiagnosis: vi.fn((_report, options) => new Promise((resolve,reject) => pending.push({resolve,reject,options}))),
}));
vi.mock('../components/diagnosis', async (original) => ({
  ...await original<typeof import('../components/diagnosis')>(),
  DiagnosisHeroPanel: (props:any) => <button disabled={props.isLoading} onClick={props.onGenerateDiagnosis}>Start test diagnosis</button>,
}));
const provider = {type:'cloud', name:'test', isAvailable:vi.fn().mockResolvedValue(true)} as any;
const config = {providerType:'cloud',cloudProvider:'google',model:'test',apiKey:'test',temperature:0.1,autoAnalyze:false} as any;
const report = runAudit([{codigo:'100'},{codigo:'101'}],['codigo'],',');
const success = (id:string) => ({success:true,result:{version:2,diagnosis:{contractId:'aura.diagnosis.v2',responseId:id,issues:[],diagnosisBlocks:[],limitations:[]},metrics:{tokensGenerated:1,latencyMs:1,model:'test'},promptHash:'test'}});
afterEach(() => {cleanup();pending.length=0;});
describe('cancelled diagnosis isolation', () => {
  it.each(['success','error'])('ignores late %s from A while B is running', async (outcome) => {
    const publish=vi.fn();
    render(<DiagnosisStep report={report} aiConfig={config} aiProvider={provider} analysisText="" onAiConfigChange={vi.fn()} onAnalysisComplete={vi.fn()} onContinue={vi.fn()} onStructuredDiagnosisComplete={publish}/>);
    fireEvent.click(screen.getByText('Start test diagnosis'));
    fireEvent.click(screen.getByTestId('progress-disclosure-cancel'));
    fireEvent.click(screen.getByText('Start test diagnosis'));
    expect(pending).toHaveLength(2);
    await act(async () => {
      pending[0].options.onProgress({type:'chunk',text:'STALE-A'});
      if(outcome==='success') pending[0].resolve(success('A'));
      else pending[0].reject(new Error('STALE-A'));
    });
    expect(publish).not.toHaveBeenCalled();
    expect(screen.queryByText(/STALE-A/)).toBeNull();
    expect((screen.getByText('Start test diagnosis') as HTMLButtonElement).disabled).toBe(true);
    await act(async () => pending[1].resolve(success('B')));
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0][0].diagnosis.responseId).toBe('B');
    expect((screen.getByText('Start test diagnosis') as HTMLButtonElement).disabled).toBe(false);
  });
  it('never publishes cancelled A after B has completed or the component unmounts', async () => {
    const publish=vi.fn();
    const view=render(<DiagnosisStep report={report} aiConfig={config} aiProvider={provider} analysisText="" onAiConfigChange={vi.fn()} onAnalysisComplete={vi.fn()} onContinue={vi.fn()} onStructuredDiagnosisComplete={publish}/>);
    fireEvent.click(screen.getByText('Start test diagnosis'));
    fireEvent.click(screen.getByTestId('progress-disclosure-cancel'));
    fireEvent.click(screen.getByText('Start test diagnosis'));
    await act(async () => pending[1].resolve(success('B')));
    await act(async () => pending[0].resolve(success('A')));
    expect(publish.mock.calls.map(call=>call[0].diagnosis.responseId)).toEqual(['B']);
    fireEvent.click(screen.getByText('Start test diagnosis'));
    view.unmount();
    await act(async () => pending[2].resolve(success('C')));
    expect(publish).toHaveBeenCalledTimes(1);
  });
});
