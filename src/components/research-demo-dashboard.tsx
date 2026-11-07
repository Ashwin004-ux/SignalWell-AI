'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { AlertTriangle, Brain, Database, FlaskConical, Play, ShieldCheck } from 'lucide-react'
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle } from '@/components/research-demo/primitives'
import { ResearchDemoAssistant } from '@/components/research-demo-assistant'

type DemoProfile = { id: string; label: string }
type Metric = { field: string; unit: string; baseline: number | null; recent: number | null; difference: number | null; percent_change: number | null }
type DailyDeviation = { baseline: number; difference: number; percent_change: number | null } | null
type DemoObservation = {
  user_id: string; date: string; day_index: number; weekday: string
  total_screen_time_minutes: number; social_media_minutes: number; late_night_usage_minutes: number
  notifications_count: number; app_switches: number; sleep_duration_minutes: number; sleep_duration_hours: number
  physical_activity_minutes: number; study_work_minutes: number; mood_score: number; stress_score: number
  anxiety_score: number; energy_score: number; wellbeing_score: number; target_kind: string; source: string
  baseline_values: Record<string, number | null>; deviations: Record<string, DailyDeviation>
  rule_score: number | null; risk_level: string; risk_reasons: string[]
}
type Analysis = {
  source: string; user_id: string; days: number; start_date: string; end_date: string; available_observations: number; coverage_status: 'complete' | 'partial' | 'empty'; observations: DemoObservation[]
  baseline: { baseline_period: { start: string; end: string; observations: number } | null; comparison_period: { start: string; end: string; observations: number } | null; convention: string; metrics: Record<string, Metric> };
  alerts: { date: string; method: string; message: string; reasons?: string[]; status: string }[];
  recommendations: { category: string; suggestion: string }[];
  latest_risk: string; baseline_ready: boolean; alert_note: string
}
type Prediction = { date: string; prediction: number; synthetic_reference: number; absolute_error: number }
type ModelState = { available: boolean; model_status: string; models: { id: string; name: string; task: string; artifact_version: string; supported_for_demo: boolean; feature_columns?: string[] }[]; message?: string | null; evaluation?: { method: string; target: string; held_out_records: number; metrics: { name?: string; MAE?: number; RMSE?: number; R2?: number }[]; dataset_source?: string; interpretation_note?: string } | null }
type Metadata = { dataset_name: string; version: string; source: string; profile_count: number; days_per_profile: number; supported_windows: number[]; target_note: string }

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || data.error || `Request failed (${response.status}).`)
  return data as T
}

function dateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}
function avg(rows: DemoObservation[], key: keyof DemoObservation) {
  if (!rows.length) return null
  const values = rows.map(row => Number(row[key])).filter(Number.isFinite)
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}
function fixed(value: number | null | undefined, digits = 1) { return value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits) }
function minutes(value: number | null) {
  if (value == null) return '—'
  const hours = Math.floor(value / 60)
  const remainder = Math.round(value % 60)
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`
}
function riskVariant(risk: string): 'success' | 'warning' | 'danger' | 'default' {
  return risk === 'stable' ? 'success' : risk === 'monitor' ? 'warning' : risk === 'elevated' ? 'danger' : 'default'
}

export function ResearchDemoDashboard() {
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [profiles, setProfiles] = useState<DemoProfile[]>([])
  const [userId, setUserId] = useState('')
  const [days, setDays] = useState<7 | 30>(7)
  const [observations, setObservations] = useState<DemoObservation[]>([])
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [models, setModels] = useState<ModelState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [predictionLoading, setPredictionLoading] = useState(false)
  const [predictionError, setPredictionError] = useState<string | null>(null)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [modelName, setModelName] = useState('production')
  const predictionController = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      fetch('/api/research-demo/metadata', { signal: controller.signal }).then(readJson<Metadata>),
      fetch('/api/research-demo/users', { signal: controller.signal }).then(readJson<DemoProfile[]>),
      fetch('/api/research-demo/models', { signal: controller.signal }).then(readJson<ModelState>),
    ]).then(([meta, users, modelState]) => {
      setMetadata(meta)
      setProfiles(users)
      setUserId(users[0]?.id || '')
      setModels(modelState)
      setModelName(modelState.models?.[0]?.id || 'production')
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load the research demo.')
    })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!userId) return
    predictionController.current?.abort()
    predictionController.current = null
    setPredictionLoading(false)
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setPredictions([])
    fetch(`/api/research-demo/users/${userId}/analysis?days=${days}`, { signal: controller.signal })
      .then(readJson<Analysis>)
      .then((analysisResult) => {
      setObservations(analysisResult.observations)
      setAnalysis(analysisResult)
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load this demo window.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [userId, days])

  useEffect(() => () => predictionController.current?.abort(), [])

  const selectedProfile = profiles.find(profile => profile.id === userId)
  const latest = observations[observations.length - 1]
  const summary = useMemo(() => ({
    screen: avg(observations, 'total_screen_time_minutes'),
    sleep: avg(observations, 'sleep_duration_hours'),
    stress: avg(observations, 'stress_score'),
  }), [observations])
  const chartRows = useMemo(() => observations.map(row => ({
    ...row,
    day: dateLabel(row.date),
    screenHours: Math.round(row.total_screen_time_minutes / 6) / 10,
    sleepHours: row.sleep_duration_hours,
    screenDeviation: row.deviations?.screen_time?.difference ?? null,
  })), [observations])

  async function runPrediction() {
    predictionController.current?.abort()
    const controller = new AbortController()
    predictionController.current = controller
    setPredictionLoading(true)
    setPredictionError(null)
    try {
      const response = await fetch('/api/research-demo/predict', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, days, model_name: modelName }),
        signal: controller.signal,
      })
      const result = await readJson<{ predictions: Prediction[] }>(response)
      setPredictions(result.predictions)
    } catch (reason) {
      if (controller.signal.aborted) return
      setPredictions([])
      setPredictionError(reason instanceof Error ? reason.message : 'Prediction could not be run.')
    } finally {
      if (predictionController.current === controller) {
        predictionController.current = null
        setPredictionLoading(false)
      }
    }
  }

  function cancelPrediction() {
    predictionController.current?.abort()
    predictionController.current = null
    setPredictionLoading(false)
    setPredictions([])
    setPredictionError(null)
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><FlaskConical className="h-5 w-5 text-signal-700" /><p className="text-xs font-semibold uppercase tracking-wide text-signal-700">Research demo mode</p></div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl">Explore daily patterns in synthetic observations</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Select a prepared profile and observation window to inspect day-level trends, baselines, rule outputs, and available model inference.</p>
        </div>
        <Badge variant="warning" className="w-fit"><Database className="mr-1.5 h-3.5 w-3.5" />SYNTHETIC DATA — ISOLATED</Badge>
      </header>

      <Card className="bg-slate-50">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="block text-sm font-medium text-slate-700">Synthetic profile
            <select aria-label="Synthetic profile" value={userId} onChange={event => { cancelPrediction(); setUserId(event.target.value) }} disabled={!profiles.length} className="mt-1.5 block h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm">
              {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
            </select>
          </label>
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">Observation window</legend>
            <div className="mt-1.5 flex gap-2">
              {[7, 30].map(window => <button key={window} type="button" aria-pressed={days === window} onClick={() => { cancelPrediction(); setDays(window as 7 | 30) }} className={`h-10 rounded border px-4 text-sm font-medium ${days === window ? 'border-signal-600 bg-signal-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}>{window} days</button>)}
            </div>
          </fieldset>
          <p className="text-xs text-slate-500">{metadata ? `${metadata.dataset_name} · v${metadata.version} · ${metadata.days_per_profile} days/profile` : 'Loading dataset details…'}</p>
        </div>
      </Card>

      <div className="border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-950">
        <strong>Research integrity:</strong> These fixed, versioned observations and wellbeing values are synthetic references. They are not participant data, clinical ground truth, or evidence of real-world effectiveness. The demo never writes to Supabase.
      </div>

      {error && <div role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {loading && <p role="status" className="text-sm text-slate-500">Loading selected synthetic observations…</p>}

      {!loading && !error && latest && analysis && <>
        <ResearchDemoAssistant key={`${userId}:${days}`} userId={userId} days={days as 7 | 30} />
        <section aria-label="Selected window summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          <SummaryCard label="Selected profile" value={selectedProfile?.label || userId} detail={`${days} day window`} />
          <SummaryCard label="Observation coverage" value={`${analysis.available_observations} / ${days} days`} detail={`${analysis.start_date} to ${analysis.end_date} · ${analysis.coverage_status}`} />
          <SummaryCard label="Mean browser usage" value={minutes(summary.screen ?? null)} detail="Descriptive average / day" />
          <SummaryCard label="Mean sleep" value={summary.sleep == null ? '—' : `${fixed(summary.sleep)} h`} detail="Descriptive average / day" />
          <SummaryCard label="Mean stress" value={summary.stress == null ? '—' : `${fixed(summary.stress)} / 10`} detail="Self-report reference" />
          <SummaryCard label="Latest wellbeing ref." value={`${latest.wellbeing_score} / 10`} detail="Synthetic reference, not prediction" />
          <SummaryCard label="Latest rule estimate" value={analysis.latest_risk.replaceAll('_', ' ')} detail={`${latest.rule_score == null ? 'Insufficient history' : `${latest.rule_score}/6 rule flags`} · ${analysis.alerts.length} simulated alerts`} />
        </section>

        <section className="grid gap-4 xl:grid-cols-2" aria-label="Lifestyle and wellbeing charts">
          <ChartCard title="Browser usage by day" description="Browser activity summary, hours/day. Synthetic values.">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={chartRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" tick={{ fontSize: 10 }} /><YAxis unit="h" /><Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ''} formatter={(value: number) => [`${fixed(value)} h`, 'Browser usage']} /><Bar dataKey="screenHours" name="Browser usage" fill="#0d88eb" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Sleep duration by day" description="Self-reported synthetic duration; baseline reference is described below.">
            <ResponsiveContainer width="100%" height="100%"><LineChart data={chartRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" tick={{ fontSize: 10 }} /><YAxis unit="h" domain={[0, 12]} /><Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ''} formatter={(value: number) => [`${fixed(value)} h`, 'Sleep']} /><Line type="monotone" dataKey="sleepHours" name="Sleep" stroke="#7c3aed" strokeWidth={2} dot={{ r: 2 }} /><ReferenceLine y={7} stroke="#94a3b8" strokeDasharray="5 4" label={{ value: '7h reference', fontSize: 10 }} /></LineChart></ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Mood and stress" description="Self-reported scale references from 1 to 10; higher stress means more reported stress.">
            <ResponsiveContainer width="100%" height="100%"><LineChart data={chartRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" tick={{ fontSize: 10 }} /><YAxis domain={[0, 10]} /><Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ''} /><Legend /><Line type="monotone" dataKey="mood_score" name="Mood reference" stroke="#0d88eb" strokeWidth={2} dot={{ r: 2 }} /><Line type="monotone" dataKey="stress_score" name="Stress reference" stroke="#e11d48" strokeWidth={2} dot={{ r: 2 }} /><Line type="monotone" dataKey="anxiety_score" name="Anxiety reference" stroke="#d97706" strokeWidth={1.5} dot={false} /></LineChart></ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Rule-based risk indicator" description="Count of fixed thresholds met across the trailing seven observations. Needs at least three observations; it is not an ML prediction or clinical risk score.">
            <ResponsiveContainer width="100%" height="100%"><LineChart data={chartRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" tick={{ fontSize: 10 }} /><YAxis domain={[0, 6]} allowDecimals={false} /><Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ''} formatter={(value: unknown) => [value == null ? 'Insufficient history' : `${value} rule indicators`, 'Rule score']} /><Line type="stepAfter" dataKey="rule_score" name="Rule score" stroke="#d97706" strokeWidth={2} dot={{ r: 2 }} /></LineChart></ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Daily browser-usage deviation" description="Today’s browser-usage minutes minus the average of the preceding seven observations. Positive is above that baseline; negative is below it.">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={chartRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" tick={{ fontSize: 10 }} /><YAxis unit="m" /><ReferenceLine y={0} stroke="#64748b" /><Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ''} formatter={(value: unknown) => [value == null ? 'No baseline' : `${Number(value) > 0 ? '+' : ''}${fixed(Number(value))} min`, 'Difference']} /><Bar dataKey="screenDeviation" name="Deviation" fill="#0891b2" /></BarChart></ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Movement and browser usage" description="Separate series with their units shown in the tooltip; no dual-axis comparison.">
            <ResponsiveContainer width="100%" height="100%"><LineChart data={chartRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" tick={{ fontSize: 10 }} /><YAxis /><Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ''} formatter={(value: number, name: string) => [`${fixed(value)} min`, name]} /><Legend /><Line type="monotone" dataKey="physical_activity_minutes" name="Movement" stroke="#16a34a" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="total_screen_time_minutes" name="Browser usage" stroke="#0d88eb" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
          </ChartCard>
        </section>

        <Card>
          <CardHeader><div><CardTitle>Personal baseline comparison</CardTitle><CardDescription className="mt-1">Baseline is synthetic and is not an actual person’s history. {analysis.baseline.convention}</CardDescription></div><ShieldCheck className="h-5 w-5 text-signal-700" /></CardHeader>
          {analysis.baseline.baseline_period && <p className="mb-3 text-xs text-slate-500">Reference: {analysis.baseline.baseline_period.start}–{analysis.baseline.baseline_period.end} · Compared with {analysis.baseline.comparison_period?.start}–{analysis.baseline.comparison_period?.end}</p>}
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-xs text-slate-500"><tr><th className="p-2">Measure</th><th className="p-2">Baseline</th><th className="p-2">Recent</th><th className="p-2">Difference</th><th className="p-2">Change</th></tr></thead><tbody className="divide-y">{Object.entries(analysis.baseline.metrics).map(([name, metric]) => <tr key={name}><th className="p-2 font-medium capitalize text-slate-700">{name.replaceAll('_', ' ')}</th><td className="p-2">{metric.baseline == null ? 'Not available' : `${fixed(metric.baseline)} ${metric.unit}`}</td><td className="p-2">{metric.recent == null ? 'Not available' : `${fixed(metric.recent)} ${metric.unit}`}</td><td className="p-2">{metric.difference == null ? '—' : `${metric.difference > 0 ? '+' : ''}${fixed(metric.difference)} ${metric.unit}`}</td><td className="p-2">{metric.percent_change == null ? '—' : `${metric.percent_change > 0 ? '+' : ''}${fixed(metric.percent_change)}%`}</td></tr>)}</tbody></table></div>
          <p className="mt-3 text-xs text-slate-500">Daily chart deviations use only prior observations, preventing future observations from entering a historical day’s baseline.</p>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardHeader><div><CardTitle>Simulated alerts</CardTitle><CardDescription className="mt-1">Existing personal-pattern alerts and fixed comparison rules replayed on synthetic rows.</CardDescription></div><AlertTriangle className="h-5 w-5 text-amber-600" /></CardHeader>
            {analysis.alerts.length ? <div className="space-y-3">{analysis.alerts.map((alert, index) => <article key={`${alert.date}-${alert.method}-${index}`} className="rounded border border-amber-200 bg-amber-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><time className="text-xs text-slate-600">{alert.date}</time><Badge variant="warning">{alert.method.replaceAll('_', ' ')}</Badge></div><p className="mt-2 text-sm text-slate-800">{alert.message}</p>{alert.reasons?.length ? <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">{alert.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul> : null}</article>)}</div> : <p className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No alert rules fired in this selected window. This is a simulated rule result.</p>}
            {analysis.recommendations.length > 0 && <div className="mt-4 border-t pt-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Non-clinical suggestions from existing rules</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{analysis.recommendations.map((item, index) => <li key={`${item.category}-${index}`}>{item.suggestion}</li>)}</ul></div>}
            <p className="mt-3 text-xs text-slate-500">{analysis.alert_note}</p>
          </Card>

          <Card>
            <CardHeader><div><CardTitle>Machine-learning inference</CardTitle><CardDescription className="mt-1">Uses the existing validated production pipeline when a compatible model is present.</CardDescription></div><Brain className="h-5 w-5 text-signal-700" /></CardHeader>
            {models?.available && models.models.length ? <>
              <p className="mb-3 text-xs text-emerald-700">Model status: {models.model_status}</p>
              <label className="mb-3 block text-sm font-medium text-slate-700">Available model<select aria-label="Available model" value={modelName} onChange={event => setModelName(event.target.value)} className="mt-1 block h-10 w-full rounded border border-slate-300 bg-white px-3">{models.models.filter(model => model.supported_for_demo).map(model => <option key={model.id} value={model.id}>{model.name} · {model.artifact_version}</option>)}</select></label>
              <p className="mb-3 text-xs text-slate-500">Backend feature columns: {models.models.find(model => model.id === modelName)?.feature_columns?.join(', ') || 'Unavailable'}.</p>
              <Button onClick={runPrediction} loading={predictionLoading} disabled={!modelName}><Play className="h-4 w-4" />Run prediction on {days} days</Button>
              {predictionError && <p role="alert" className="mt-3 text-sm text-red-700">{predictionError}</p>}
              {predictions.length > 0 && <>
                <p className="mt-3 text-xs text-slate-500">Actual model inference · reference values are synthetic, not clinical ground truth · per-row differences are illustrative.</p>
                <div className="mt-3 h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={predictions.map(row => ({ ...row, day: dateLabel(row.date) }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" tick={{ fontSize: 10 }} /><YAxis domain={[0, 10]} /><Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ''} formatter={(value: number) => [fixed(value, 2), 'Score / 10']} /><Legend /><Line type="monotone" dataKey="synthetic_reference" name="Synthetic reference" stroke="#64748b" strokeDasharray="5 4" dot={false} /><Line type="monotone" dataKey="prediction" name="Model prediction" stroke="#0d88eb" strokeWidth={2} dot={{ r: 2 }} /></LineChart></ResponsiveContainer></div>
                <div className="mt-3 overflow-x-auto"><table className="w-full text-xs"><thead className="border-b text-left text-slate-500"><tr><th className="p-2">Date</th><th className="p-2">Prediction</th><th className="p-2">Reference</th><th className="p-2">Absolute difference</th></tr></thead><tbody>{predictions.map(row => <tr key={row.date} className="border-b"><td className="p-2">{row.date}</td><td className="p-2">{fixed(row.prediction, 2)}</td><td className="p-2">{fixed(row.synthetic_reference, 2)}</td><td className="p-2">{fixed(row.absolute_error, 2)}</td></tr>)}</tbody></table></div>
              </>}
              {models.evaluation?.metrics?.length ? <div className="mt-4 border-t pt-3"><p className="text-sm font-medium text-slate-700">Recorded held-out evaluation</p><p className="mt-1 text-xs text-slate-500">{models.evaluation.method} · {models.evaluation.held_out_records} held-out rows · target: {models.evaluation.target}</p><div className="mt-2 flex flex-wrap gap-3 text-xs">{models.evaluation.metrics.map((metric, index) => <span key={`${metric.name}-${index}`}>{metric.name}: MAE {fixed(metric.MAE, 3)} · RMSE {fixed(metric.RMSE, 3)} · R² {fixed(metric.R2, 3)}</span>)}</div>{models.evaluation.interpretation_note && <p className="mt-2 text-xs text-amber-800">{models.evaluation.dataset_source === 'synthetic_demo' ? 'Synthetic fixture only. ' : ''}{models.evaluation.interpretation_note}</p>}</div> : <p className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">No reproducible held-out evaluation is recorded for this artifact. Demo rows are not used to calculate model-performance metrics.</p>}
              <p className="mt-3 text-xs text-slate-500">Feature explainability is hidden pending stability validation; feature contributions are not causal effects.</p>
            </> : <div className="rounded border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-medium text-slate-800">Model inference unavailable · {models?.model_status || 'status unavailable'}</p><p className="mt-1 text-sm text-slate-600">{models?.message || (models?.available ? 'A model artifact is present, but it is not a compatible regression model for the wellbeing score.' : 'The FastAPI service has not returned model availability.')}</p><p className="mt-2 text-xs text-slate-500">Charts and synthetic reference analyses remain available. No random or precomputed prediction is substituted.</p></div>}
            {models?.models.some(model => !model.supported_for_demo) && <p className="mt-3 text-xs text-amber-800">The available artifact is a classifier; the demo target is a continuous wellbeing score, so this artifact is not used here.</p>}
            <details className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <summary className="cursor-pointer font-medium text-slate-800">Which ML models are in the pipeline?</summary>
              <div className="mt-2 space-y-2">
                <p><strong>For wellbeing regression:</strong> Linear Regression is the simple weighted baseline; Random Forest averages decision trees to model nonlinear patterns; XGBoost builds boosted trees in sequence. The service compares these on held-out records and selects the lowest-MAE regression candidate. Tree counts are checked at 100 and 200 during tuning when the data split supports cross-validation.</p>
                <p><strong>Other training task:</strong> Logistic Regression, Random Forest Classifier, and XGBoost Classifier are available for categorical targets. They are not used for this demo’s continuous wellbeing score.</p>
                <p><strong>Not active models:</strong> LSTM, GRU, and Transformer entries are architecture placeholders; this app does not currently train or run them.</p>
                <p>Inputs are numerically prepared, missing feature values are median-imputed, and scaling is fitted within training folds. Regression metrics are MAE, RMSE, and R². The current fitted production artifact status is shown above; synthetic-fixture metrics are pipeline demonstrations only, not real-world validation.</p>
              </div>
            </details>
          </Card>
        </div>

        <Card>
          <CardHeader><div><CardTitle>Daily observation table</CardTitle><CardDescription className="mt-1">All {observations.length} rows in the selected {days}-day window; generated synthetic references.</CardDescription></div><Badge variant="info">source: synthetic_demo</Badge></CardHeader>
          <div className="overflow-x-auto"><table className="w-full min-w-[1200px] text-left text-xs"><thead className="border-b bg-slate-50 text-slate-500"><tr>{['Date', 'Browser (min)', 'Social (min)', 'Late night (min)', 'Notifications', 'App switches', 'Sleep (h)', 'Movement (min)', 'Mood', 'Stress', 'Anxiety', 'Wellbeing ref.'].map(label => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y">{observations.map(row => <tr key={row.date}><td className="p-2 font-medium">{row.date} · {row.weekday}</td><td className="p-2">{row.total_screen_time_minutes}</td><td className="p-2">{row.social_media_minutes}</td><td className="p-2">{row.late_night_usage_minutes}</td><td className="p-2">{row.notifications_count}</td><td className="p-2">{row.app_switches}</td><td className="p-2">{fixed(row.sleep_duration_hours, 2)}</td><td className="p-2">{row.physical_activity_minutes}</td><td className="p-2">{row.mood_score}</td><td className="p-2">{row.stress_score}</td><td className="p-2">{row.anxiety_score}</td><td className="p-2">{row.wellbeing_score}</td></tr>)}</tbody></table></div>
        </Card>
      </>}

      <p className="text-xs text-slate-500">{metadata?.target_note} Rule-based estimates and actions are educational research outputs only and do not diagnose or recommend urgent care.</p>
    </main>
  )
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <Card padding="sm"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 break-words text-lg font-semibold capitalize tabular-nums text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></Card>
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <Card><CardHeader><div><CardTitle>{title}</CardTitle><CardDescription className="mt-1">{description}</CardDescription></div></CardHeader><div className="h-64" role="img" aria-label={title}>{children}</div></Card>
}
