import { useSearchParams, Link } from 'react-router-dom';
import { ArrowUpRight, Calculator, CheckCheck, Landmark, Ruler, ShoppingBasket, Sparkles, UsersRound } from 'lucide-react';
import { LIFE_TOOLS, resolveLifeTool } from '../../data/tool-catalog';
import type { ShowToast } from '../../app/context';
import { AiCommunicationTool } from './AiCommunicationTool';
import { UnitConverterTool } from './UnitConverterTool';
import { RentalBudgetTool, SharedBillTool } from './BudgetTools';
import { MovingChecklistTool } from './MovingChecklistTool';
import { LoanCalculatorTool } from './LoanCalculatorTool';
import { UnitPriceTool } from './UnitPriceTool';
import './tools.css';
import './loan-calculator.css';

const ICONS = { sparkles: Sparkles, ruler: Ruler, users: UsersRound, calculator: Calculator, checklist: CheckCheck, landmark: Landmark, basket: ShoppingBasket };
export function ToolsHub({ storageScope, onToast }: { storageScope: string; onToast: ShowToast }) {
  const [params] = useSearchParams();
  const active = resolveLifeTool(params.get('tool'));
  const current = LIFE_TOOLS.find(tool => tool.id === active)!;
  const CurrentIcon = ICONS[current.icon];
  return <div className="life-tools">
    <header className="tools-hero"><div><span className="tools-eyebrow">A LITTLE EASIER, EVERY DAY</span><h1>生活的小麻烦，<br /><em>顺手解决。</em></h1><p>从一句英文、一笔账，到搬家前的一张清单。<br />给湾区日常，准备一套用得上的小工具。</p></div><div className="tools-hero-art" aria-hidden="true"><div><Sparkles /><span>表达清楚</span></div><div><Calculator /><span>心里有数</span></div><div><CheckCheck /><span>慢慢办妥</span></div></div></header>
    <nav className="tools-picker" aria-label="选择生活工具">{LIFE_TOOLS.map(tool => { const Icon = ICONS[tool.icon]; return <Link key={tool.id} to={`/tools?tool=${tool.id}#tool-workspace`} aria-current={active === tool.id ? 'page' : undefined} className={`tools-picker-card ${active === tool.id ? 'is-active' : ''}`}><span className="tools-picker-icon"><Icon size={22} /></span><span className="tools-picker-tag">{tool.tag}</span><strong>{tool.title}</strong><small>{tool.short}</small><ArrowUpRight className="tools-picker-arrow" size={17} /></Link>; })}</nav>
    <section id="tool-workspace" className="tool-workspace" aria-labelledby="active-tool-title"><header className="tool-workspace-header"><span><CurrentIcon size={24} /></span><div><p>{current.tag}</p><h2 id="active-tool-title">{current.title}</h2><p>{current.description}</p></div></header>
      <div className="tool-workspace-body">
        <div hidden={active !== 'communication'}><AiCommunicationTool onToast={onToast} /></div>
        <div hidden={active !== 'loan'}><LoanCalculatorTool onToast={onToast} /></div>
        <div hidden={active !== 'unit-price'}><UnitPriceTool onToast={onToast} /></div>
        <div hidden={active !== 'units'}><UnitConverterTool onToast={onToast} /></div>
        <div hidden={active !== 'split'}><SharedBillTool onToast={onToast} /></div>
        <div hidden={active !== 'budget'}><RentalBudgetTool onToast={onToast} /></div>
        <div hidden={active !== 'moving'}><MovingChecklistTool key={storageScope} storageScope={storageScope} onToast={onToast} /></div>
      </div>
    </section>
    <footer className="tools-footer"><p>计算和清单在本机处理；AI 沟通仅在你点击生成后提交内容。<br />关闭页面后，未保存的计算输入和沟通草稿不会保留。</p><Link to="/guides">需要更完整的生活攻略？<span>看看湾区指南 <ArrowUpRight size={15} /></span></Link></footer>
  </div>;
}
