'use client';

import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Coffee, Eye, EyeOff, Wallet } from 'lucide-react';
import { BarChart } from '@finapp/ui/analytics';
import { Money } from '@finapp/ui/finance';

const periods = {
  Week: {
    values: [420, 180, 640, 280, 820, 540, 360],
    labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    amountMinor: 324000n,
  },
  Month: {
    values: [1680, 2240, 1820, 3240],
    labels: ['W1', 'W2', 'W3', 'W4'],
    amountMinor: 898000n,
  },
} as const;

type Period = keyof typeof periods;

export function ProductPreview() {
  const [period, setPeriod] = useState<Period>('Week');
  const [hidden, setHidden] = useState(false);
  const data = periods[period];

  return (
    <div className="landing-product" aria-label="Interactive Finapp preview with sample data">
      <div className="landing-product-header">
        <span className="landing-product-brand">finapp<span>.</span></span>
        <span className="landing-sample-label">Sample account</span>
      </div>
      <div className="landing-balance-label">
        <span>Total balance</span>
        <button
          type="button"
          aria-label={hidden ? 'Show sample balance' : 'Hide sample balance'}
          aria-pressed={hidden}
          onClick={() => setHidden(!hidden)}
        >
          {hidden ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      <div className="landing-product-balance">
        <Money amountMinor={12485000n} currency="INR" size="hero" hidden={hidden} />
      </div>
      <div className="landing-product-flow">
        <div><ArrowDownLeft size={16} /><span>Income</span><Money amountMinor={4800000n} currency="INR" hidden={hidden} /></div>
        <div><ArrowUpRight size={16} /><span>Expenses</span><Money amountMinor={898000n} currency="INR" hidden={hidden} /></div>
      </div>
      <div className="landing-chart-header">
        <div>
          <span>Spending this {period.toLowerCase()}</span>
          <div aria-live="polite"><Money amountMinor={data.amountMinor} currency="INR" size="display" /></div>
        </div>
        <div className="landing-periods" role="group" aria-label="Sample spending period">
          {(Object.keys(periods) as Period[]).map((item) => (
            <button key={item} type="button" aria-pressed={period === item} onClick={() => setPeriod(item)}>{item}</button>
          ))}
        </div>
      </div>
      <div className="landing-chart" role="img" aria-label={`Sample ${period.toLowerCase()} spending: ${data.values.join(', ')} rupees`}>
        <BarChart values={data.values} labels={data.labels} highlightIndex={data.values.length - 1} />
      </div>
      <div className="landing-recent">
        <span>Recent activity</span>
        <div><span className="landing-activity-icon"><Coffee size={18} /></span><span>Coffee break<small>Food & drinks</small></span><Money amountMinor={24000n} currency="INR" type="expense" /></div>
        <div><span className="landing-activity-icon"><Wallet size={18} /></span><span>Monthly salary<small>Income</small></span><Money amountMinor={4800000n} currency="INR" type="income" /></div>
      </div>
    </div>
  );
}
