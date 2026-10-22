import { useSearchParams, Link } from 'react-router-dom';
import { Calculator, CheckCheck, Landmark, ReceiptText, Ruler, ShoppingBasket, Sparkles, UsersRound } from 'lucide-react';
import { LIFE_TOOLS, resolveLifeTool } from '../../data/tool-catalog';
import { translateText, useLocale } from '../../i18n/locale';
import type { ShowToast } from '../../app/context';
import { PageContainer, PageHeader } from '../ui/PageHeader';
import { AiCommunicationTool } from './AiCommunicationTool';
import { UnitConverterTool } from './UnitConverterTool';
import { RentalBudgetTool, SharedBillTool } from './BudgetTools';
import { MovingChecklistTool } from './MovingChecklistTool';
import { LoanCalculatorTool } from './LoanCalculatorTool';
import { UnitPriceTool } from './UnitPriceTool';
import { DiningCalculator } from './DiningCalculator';
import './tools.css';
import './loan-calculator.css';

const ICONS = { sparkles: Sparkles, ruler: Ruler, users: UsersRound, calculator: Calculator, checklist: CheckCheck, landmark: Landmark, basket: ShoppingBasket, receipt: ReceiptText };

/** 生活工具箱 (/tools, WEB-SECONDARY-A): PageHeader, a list of the eight tools, then the open tool's workspace. Forms use the
 * shared primitives (UI9-R1-TOOLS): Button / IconButton looks, Select, the selected pair on the open tool. */
export function ToolsHub({ storageScope, onToast }: { storageScope: string; onToast: ShowToast }) {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const [params] = useSearchParams();
  const requested = params.get('tool');
  // At rest (no valid ?tool=) nothing is chosen: a phone shows the eight tiles only, none selected, and the workspace
  // appears once a tile is tapped (J1 P22). A desktop still opens the first tool beside the list.
  const chosen = LIFE_TOOLS.some(tool => tool.id === requested);
  const active = resolveLifeTool(requested);
  const current = LIFE_TOOLS.find(tool => tool.id === active)!;
  const CurrentIcon = ICONS[current.icon];
  return <PageContainer className="tools-page">
    <PageHeader title={t('生活工具箱', 'Everyday tools')}
      lede={t('算小费、比单价、算房贷、写一条英文消息。计算在你的浏览器里完成；AI 沟通只在你点按钮生成草稿时提交内容。', 'Tips, unit prices, a mortgage, a message in English. Calculations stay in your browser; the AI helper sends your text only when you tap the button to generate a draft.')} />
    <div className="tools-layout" data-rest={chosen ? undefined : ''}>
      <nav className="tools-picker" aria-label="选择生活工具">
        <ul>
          {LIFE_TOOLS.map(tool => { const Icon = ICONS[tool.icon]; return <li key={tool.id}><Link to={`/tools?tool=${tool.id}#tool-workspace`} aria-current={chosen && active === tool.id ? 'page' : undefined} data-open={active === tool.id ? '' : undefined} className="tools-picker-item">
            <span className="tools-picker-icon" aria-hidden="true"><Icon strokeWidth={1.75} /></span>
            <span className="tools-picker-text"><strong>{tool.title}</strong><small>{tool.short}</small><span className="tools-picker-tag">{tool.tag}</span></span>
          </Link></li>; })}
        </ul>
      </nav>
      <section id="tool-workspace" className="tool-workspace" aria-labelledby="active-tool-title">
        <header className="tool-workspace-header"><span aria-hidden="true"><CurrentIcon strokeWidth={1.75} /></span><div><p>{current.tag}</p><h2 id="active-tool-title">{current.title}</h2><p>{current.description}</p></div></header>
        <div className="tool-workspace-body">
          <div hidden={active !== 'communication'}><AiCommunicationTool onToast={onToast} /></div>
          <div hidden={active !== 'dining'}><DiningCalculator onToast={onToast} /></div>
          <div hidden={active !== 'loan'}><LoanCalculatorTool onToast={onToast} /></div>
          <div hidden={active !== 'unit-price'}><UnitPriceTool onToast={onToast} /></div>
          <div hidden={active !== 'units'}><UnitConverterTool onToast={onToast} /></div>
          <div hidden={active !== 'split'}><SharedBillTool onToast={onToast} /></div>
          <div hidden={active !== 'budget'}><RentalBudgetTool onToast={onToast} /></div>
          <div hidden={active !== 'moving'}><MovingChecklistTool key={storageScope} storageScope={storageScope} onToast={onToast} /></div>
        </div>
      </section>
    </div>
    <footer className="tools-footer"><p>关闭页面后，未保存的计算输入和沟通草稿不会保留。</p><Link to="/guides">{t('需要更完整的办事步骤？看湾区指南', 'Need the full steps? Read the Bay Area guides')}</Link></footer>
  </PageContainer>;
}
