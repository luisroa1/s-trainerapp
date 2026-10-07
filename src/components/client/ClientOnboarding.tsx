import React from 'react';
import { ArrowLeft, Check, ChevronRight, Loader2 } from 'lucide-react';
import { supabaseDb } from '../../lib/supabase';
import {
  CLIENT_ONBOARDING_STEPS,
  clientGreetingName,
  firstMissingOnboardingStep,
  greetingForLocalHour,
  localISODate,
  onboardingExperienceShape,
} from '../../lib/clientOnboarding.mjs';

type Step = 'welcome' | typeof CLIENT_ONBOARDING_STEPS[number] | 'done';
type Snapshot = {
  profile: any | null;
  training: any | null;
  latestWeight: any | null;
  goal: any | null;
  health: any | null;
  menstrual: any | null;
};

interface ClientOnboardingProps {
  clientId: string;
  registeredName: string;
  preferredName?: string | null;
  initialStep: Step;
  onFinishOnboarding: (preferredName: string | null) => void;
}

const EMPTY_SNAPSHOT: Snapshot = { profile: null, training: null, latestWeight: null, goal: null, health: null, menstrual: null };

const GOALS = [
  ['gain_muscle', 'Ganar músculo'], ['lose_fat', 'Perder grasa'], ['gain_strength', 'Ganar fuerza'],
  ['health', 'Mejorar mi salud'], ['performance', 'Mejorar mi rendimiento'], ['return_to_training', 'Volver a entrenar'], ['other', 'Otro'],
] as const;
const ACTIVITIES = [
  ['mostly_seated', 'Paso gran parte del día sentado.'],
  ['frequent_light_movement', 'Me muevo con frecuencia, sin demasiado esfuerzo físico.'],
  ['mostly_standing_or_walking', 'Paso buena parte del día de pie o caminando.'],
  ['physically_demanding', 'Mi día requiere bastante esfuerzo físico.'],
  ['varies', 'Depende mucho del día.'],
] as const;
const EXPERIENCES = [
  ['under_6_months', 'Menos de 6 meses'], ['6_12_months', '6–12 meses'], ['1_3_years', '1–3 años'], ['over_3_years', 'Más de 3 años'],
] as const;
const TIME_SINCE = [
  ['under_1_month', 'Menos de 1 mes'], ['1_6_months', '1–6 meses'], ['6_months_2_years', '6 meses–2 años'], ['over_2_years', 'Más de 2 años'],
] as const;
const HEALTH_CATEGORIES = [
  ['injury_or_discomfort', 'Lesión o molestia'], ['medical_condition', 'Enfermedad o condición médica'],
  ['prior_surgery', 'Operación previa'], ['other', 'Otra situación'],
] as const;
const BODY_REGIONS = [
  ['Cabeza/cuello', 'Cabeza / cuello'], ['Hombro/brazo', 'Hombro / brazo'], ['Codo/antebrazo', 'Codo / antebrazo'],
  ['Mano/muñeca', 'Mano / muñeca'], ['Espalda', 'Espalda'], ['Cadera/pelvis', 'Cadera / pelvis'],
  ['Rodilla', 'Rodilla'], ['Pierna/tobillo/pie', 'Pierna / tobillo / pie'], ['Otra', 'Otra'],
] as const;
const NEXT_STEP: Record<string, Step> = {
  profile: 'goal', goal: 'activity', activity: 'experience', experience: 'availability', availability: 'health',
};

function Choice<T extends string>({ value, current, label, onChoose }: { value: T; current: T | ''; label: string; onChoose: (value: T) => void }) {
  const selected = current === value;
  return (
    <button type="button" aria-pressed={selected} onClick={() => onChoose(value)} className={`min-h-12 w-full rounded-2xl border px-4 py-3 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${selected ? 'border-cyan-300 bg-cyan-300/10 text-[#F5F4F0]' : 'border-[#34343A] bg-[#1B1B1F] text-[#D4D4D8] hover:border-[#54545C]'}`}>
      {label}
    </button>
  );
}

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-[#B5B5BC]">{label}</span><input {...props} aria-label={label} className={`min-h-12 w-full rounded-xl border border-[#34343A] bg-[#1B1B1F] px-4 py-3 text-base text-[#F5F4F0] outline-none focus:border-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-300/50 ${props.className || ''}`} /></label>;
}

function TextArea({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-[#B5B5BC]">{label}</span><textarea {...props} aria-label={label} className={`min-h-24 w-full resize-y rounded-xl border border-[#34343A] bg-[#1B1B1F] px-4 py-3 text-sm text-[#F5F4F0] outline-none focus:border-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-300/50 ${props.className || ''}`} /></label>;
}

export const ClientOnboarding: React.FC<ClientOnboardingProps> = ({ clientId, registeredName, preferredName, initialStep, onFinishOnboarding }) => {
  const [step, setStep] = React.useState<Step>(initialStep);
  const [snapshot, setSnapshot] = React.useState<Snapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [returnToReview, setReturnToReview] = React.useState(false);

  const [usePreferredName, setUsePreferredName] = React.useState(Boolean(preferredName));
  const [preferred, setPreferred] = React.useState(preferredName || '');
  const [birthDate, setBirthDate] = React.useState('');
  const [heightCm, setHeightCm] = React.useState('');
  const [physiologicalSex, setPhysiologicalSex] = React.useState<'male' | 'female' | 'not_provided' | ''>('');
  const [weightKg, setWeightKg] = React.useState('');
  const [weightMeasuredOn, setWeightMeasuredOn] = React.useState(localISODate());
  const [goal, setGoal] = React.useState('');
  const [goalOther, setGoalOther] = React.useState('');
  const [secondaryGoals, setSecondaryGoals] = React.useState<string[]>([]);
  const [secondaryOther, setSecondaryOther] = React.useState('');
  const [activity, setActivity] = React.useState('');
  const [stepsBand, setStepsBand] = React.useState('');
  const [trainingStatus, setTrainingStatus] = React.useState<'never' | 'previously' | 'currently' | ''>('');
  const [experienceBand, setExperienceBand] = React.useState('');
  const [timeSinceBand, setTimeSinceBand] = React.useState('');
  const [availability, setAvailability] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [healthAnswer, setHealthAnswer] = React.useState<'yes' | 'no' | ''>('');
  const [healthCategories, setHealthCategories] = React.useState<string[]>([]);
  const [bodyRegion, setBodyRegion] = React.useState('');
  const [healthDescription, setHealthDescription] = React.useState('');
  const [cycleChoice, setCycleChoice] = React.useState<'yes' | 'not_now' | ''>('');
  const [lastMenstrualStart, setLastMenstrualStart] = React.useState('');
  const [cycleDays, setCycleDays] = React.useState('');
  const [cyclePattern, setCyclePattern] = React.useState<'regular' | 'irregular' | 'unknown' | ''>('');

  React.useEffect(() => {
    let current = true;
    setLoading(true);
    supabaseDb.getClientOnboardingSnapshot(clientId).then(({ data, error: loadError }) => {
      if (!current) return;
      if (loadError || !data) {
        setError('No se pudieron cargar tus respuestas guardadas. Reintenta para continuar con seguridad.');
        setLoading(false);
        return;
      }
      setSnapshot(data as Snapshot);
      const profile = data.profile || {};
      const training = data.training || {};
      const goalRow = data.goal || {};
      const health = data.health || {};
      const menstrual = data.menstrual || {};
      setPreferred(profile.preferred_name || preferredName || '');
      setUsePreferredName(Boolean(profile.preferred_name || preferredName));
      setBirthDate(profile.date_of_birth || '');
      setHeightCm(profile.height_cm == null ? '' : String(profile.height_cm));
      setPhysiologicalSex(profile.physiological_sex || '');
      setWeightKg(data.latestWeight?.weight_kg == null ? '' : String(data.latestWeight.weight_kg));
      if (data.latestWeight?.measured_on) setWeightMeasuredOn(data.latestWeight.measured_on);
      setGoal(goalRow.primary_goal || '');
      setGoalOther(goalRow.primary_other_text || '');
      setSecondaryGoals(goalRow.secondary_goals || []);
      setSecondaryOther(goalRow.secondary_other_text || '');
      setActivity(training.daily_activity_pattern || '');
      setStepsBand(training.daily_steps_band || '');
      setTrainingStatus(training.strength_training_status || '');
      setExperienceBand(training.experience_band || '');
      setTimeSinceBand(training.time_since_training_band || '');
      setAvailability(training.availability_days || '');
      setLocation(training.training_location || '');
      setHealthAnswer(health.has_relevant_information === true ? 'yes' : health.has_relevant_information === false ? 'no' : '');
      setHealthCategories(health.categories || []);
      setBodyRegion(health.body_region || '');
      setHealthDescription(health.description || '');
      setCycleChoice(menstrual.tracking_choice || '');
      setLastMenstrualStart(menstrual.last_menstrual_start || '');
      setCycleDays(menstrual.usual_cycle_days == null ? '' : String(menstrual.usual_cycle_days));
      setCyclePattern(menstrual.cycle_pattern || '');
      setError(null);
      setLoading(false);
    }).catch(() => {
      if (!current) return;
      setError('No se pudieron cargar tus respuestas guardadas. Reintenta para continuar con seguridad.');
      setLoading(false);
    });
    return () => { current = false; };
  }, [clientId, preferredName]);

  const displayName = clientGreetingName(snapshot.profile?.preferred_name || (usePreferredName ? preferred : preferredName), registeredName);
  const localGreeting = greetingForLocalHour(new Date().getHours());
  const cycleEligible = physiologicalSex === 'female';
  const nextStepFor = (current: Step): Step => returnToReview ? 'review' : (NEXT_STEP[current] || (current === 'health' ? (cycleEligible ? 'cycle' : 'review') : 'review'));

  const saveProgressAndAdvance = async (nextStep: Step) => {
    const progress = await supabaseDb.saveClientOnboardingProgress(nextStep);
    if (progress.error) throw progress.error;
    setError(null);
    setReturnToReview(false);
    setStep(nextStep);
  };

  const runSave = async (operation: () => Promise<void>) => {
    setSaving(true);
    setError(null);
    try { await operation(); }
    catch (saveError) {
      console.warn('Client onboarding save failed:', saveError);
      setError('No se pudo guardar todavía. Tus respuestas siguen aquí; puedes reintentar.');
    } finally { setSaving(false); }
  };

  const goBack = () => {
    setError(null);
    if (returnToReview) { setReturnToReview(false); setStep('review'); return; }
    const previous: Record<string, Step> = { profile: 'welcome', goal: 'profile', activity: 'goal', experience: 'activity', availability: 'experience', health: 'availability', cycle: 'health', review: cycleEligible ? 'cycle' : 'health' };
    setStep(previous[step] || 'welcome');
  };

  const begin = () => runSave(() => saveProgressAndAdvance('profile'));

  const saveProfile = () => runSave(async () => {
    const parsedHeight = Number(heightCm.replace(',', '.'));
    if (!birthDate || new Date(`${birthDate}T00:00:00`).getTime() > new Date().setHours(23, 59, 59, 999)) throw new Error('birth date required or in future');
    if (!Number.isFinite(parsedHeight) || parsedHeight < 30 || parsedHeight > 300) throw new Error('height out of range');
    const result = await supabaseDb.saveClientOnboardingProfile(clientId, {
      preferred_name: usePreferredName && preferred.trim() ? preferred.trim() : null,
      date_of_birth: birthDate,
      physiological_sex: physiologicalSex || null,
      height_cm: parsedHeight,
    });
    if (result.error || !result.data) throw result.error || new Error('profile not confirmed');
    let savedWeight = snapshot.latestWeight;
    if (weightKg.trim()) {
      const weight = Number(weightKg.replace(',', '.'));
      if (!Number.isFinite(weight) || weight <= 0 || weight > 1000) throw new Error('weight out of range');
      const weightResult = await supabaseDb.saveClientOnboardingWeight(clientId, weight, weightMeasuredOn || localISODate());
      if (weightResult.error || !weightResult.data) throw weightResult.error || new Error('weight not confirmed');
      savedWeight = weightResult.data;
    }
    setSnapshot(current => ({ ...current, profile: result.data, latestWeight: savedWeight }));
    await saveProgressAndAdvance(nextStepFor('profile'));
  });

  const saveGoal = () => runSave(async () => {
    if (!goal) throw new Error('goal required');
    const secondaries = secondaryGoals.filter(value => value !== goal).slice(0, 2);
    if (goal === 'other' && !goalOther.trim()) throw new Error('other goal text required');
    if (secondaries.includes('other') && !secondaryOther.trim()) throw new Error('other secondary text required');
    const result = await supabaseDb.saveClientOnboardingGoal({
      primary_goal: goal,
      primary_other_text: goal === 'other' ? goalOther.trim() : null,
      secondary_goals: secondaries.length ? secondaries : null,
      secondary_other_text: secondaries.includes('other') ? secondaryOther.trim() : null,
    });
    if (result.error || !result.data) throw result.error || new Error('goal not confirmed');
    setSnapshot(current => ({ ...current, goal: { id: result.data, primary_goal: goal, primary_other_text: goal === 'other' ? goalOther.trim() : null, secondary_goals: secondaries.length ? secondaries : null, secondary_other_text: secondaries.includes('other') ? secondaryOther.trim() : null, ended_at: null } }));
    await saveProgressAndAdvance(nextStepFor('goal'));
  });

  const saveActivity = () => runSave(async () => {
    if (!activity || !stepsBand) throw new Error('activity context required');
    const values = { ...(snapshot.training || {}), daily_activity_pattern: activity, daily_steps_band: stepsBand };
    const result = await supabaseDb.saveClientTrainingContext(clientId, values);
    if (result.error || !result.data) throw result.error || new Error('activity not confirmed');
    setSnapshot(current => ({ ...current, training: result.data }));
    await saveProgressAndAdvance(nextStepFor('activity'));
  });

  const saveExperience = () => runSave(async () => {
    if (!trainingStatus || (trainingStatus !== 'never' && !experienceBand) || (trainingStatus === 'previously' && !timeSinceBand)) throw new Error('experience branch incomplete');
    const values = {
      ...(snapshot.training || {}),
      daily_activity_pattern: activity || snapshot.training?.daily_activity_pattern || null,
      daily_steps_band: stepsBand || snapshot.training?.daily_steps_band || null,
      strength_training_status: trainingStatus,
      ...onboardingExperienceShape(trainingStatus, experienceBand, timeSinceBand),
    };
    const result = await supabaseDb.saveClientTrainingContext(clientId, values);
    if (result.error || !result.data) throw result.error || new Error('experience not confirmed');
    setSnapshot(current => ({ ...current, training: result.data }));
    await saveProgressAndAdvance(nextStepFor('experience'));
  });

  const saveAvailability = () => runSave(async () => {
    if (!availability || !location) throw new Error('availability required');
    const result = await supabaseDb.saveClientTrainingContext(clientId, {
      ...(snapshot.training || {}),
      daily_activity_pattern: activity || snapshot.training?.daily_activity_pattern || null,
      daily_steps_band: stepsBand || snapshot.training?.daily_steps_band || null,
      strength_training_status: trainingStatus || snapshot.training?.strength_training_status || null,
      ...onboardingExperienceShape(trainingStatus || snapshot.training?.strength_training_status, experienceBand || snapshot.training?.experience_band, timeSinceBand || snapshot.training?.time_since_training_band),
      availability_days: availability,
      training_location: location,
    });
    if (result.error || !result.data) throw result.error || new Error('availability not confirmed');
    setSnapshot(current => ({ ...current, training: result.data }));
    await saveProgressAndAdvance(nextStepFor('availability'));
  });

  const saveHealth = () => runSave(async () => {
    if (!healthAnswer) throw new Error('health answer required');
    const categories = healthAnswer === 'yes' ? healthCategories : [];
    if (healthAnswer === 'yes' && categories.length === 0) throw new Error('health category required');
    if (healthAnswer === 'yes' && categories.includes('injury_or_discomfort') && !bodyRegion.trim()) throw new Error('body region required');
    const values = {
      has_relevant_information: healthAnswer === 'yes',
      categories,
      body_region: healthAnswer === 'yes' && categories.includes('injury_or_discomfort') ? bodyRegion.trim() : null,
      description: healthAnswer === 'yes' && healthDescription.trim() ? healthDescription.trim() : null,
    };
    const result = await supabaseDb.saveClientHealthDeclaration(clientId, values);
    if (result.error || !result.data) throw result.error || new Error('health declaration not confirmed');
    setSnapshot(current => ({ ...current, health: result.data }));
    await saveProgressAndAdvance(nextStepFor('health'));
  });

  const saveCycle = (choice: 'yes' | 'not_now' = cycleChoice as 'yes' | 'not_now') => runSave(async () => {
    if (!choice) throw new Error('cycle choice required');
    const days = cycleDays.trim() ? Number(cycleDays) : null;
    if (days !== null && (!Number.isInteger(days) || days < 1 || days > 90)) throw new Error('cycle length out of range');
    if (choice === 'yes' && !cyclePattern) throw new Error('cycle pattern required');
    const result = await supabaseDb.saveClientMenstrualChoice(clientId, {
      tracking_choice: choice,
      last_menstrual_start: choice === 'yes' && lastMenstrualStart ? lastMenstrualStart : null,
      usual_cycle_days: choice === 'yes' ? days : null,
      cycle_pattern: choice === 'yes' ? (cyclePattern || null) : null,
    });
    if (result.error || !result.data) throw result.error || new Error('cycle choice not confirmed');
    setSnapshot(current => ({ ...current, menstrual: result.data }));
    await saveProgressAndAdvance('review');
  });

  const complete = () => runSave(async () => {
    const missingStep = firstMissingOnboardingStep(snapshot);
    if (missingStep) {
      setStep(missingStep);
      setReturnToReview(true);
      setError('Hay un dato necesario que aún no está guardado. Revísalo para terminar.');
      return;
    }
    const result = await supabaseDb.completeClientOnboarding();
    if (result.error || !result.data) throw result.error || new Error('completion not confirmed');
    setStep('done');
  });

  const edit = (target: Step) => { setReturnToReview(true); setError(null); setStep(target); };
  const toggleSecondary = (value: string) => setSecondaryGoals(current => current.includes(value) ? current.filter(item => item !== value) : current.length < 2 ? [...current, value] : current);
  const toggleHealthCategory = (value: string) => setHealthCategories(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  const today = localISODate();
  const sectionIndex = CLIENT_ONBOARDING_STEPS.indexOf(step as typeof CLIENT_ONBOARDING_STEPS[number]);
  const person = displayName ? `, ${displayName}` : '';

  if (loading) return <main className="min-h-screen bg-[#101012] text-[#F5F4F0] flex items-center justify-center p-6"><p role="status" className="flex items-center gap-2 text-sm text-[#B5B5BC]"><Loader2 className="h-4 w-4 animate-spin" /> Cargando tus respuestas guardadas…</p></main>;

  return (
    <main className="min-h-screen bg-[#101012] px-5 py-6 text-[#F5F4F0] sm:flex sm:items-center sm:justify-center">
      <section className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-lg flex-col rounded-[28px] border border-white/5 bg-[#141417] p-5 shadow-2xl sm:min-h-[680px] sm:p-8">
        {step !== 'welcome' && step !== 'done' && <div className="mb-7 flex items-center gap-3">
          <button type="button" onClick={goBack} aria-label="Volver" disabled={saving} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#34343A] bg-[#1B1B1F] text-[#D4D4D8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:opacity-50"><ArrowLeft className="h-5 w-5" /></button>
          <div className="flex flex-1 gap-1.5" aria-label="Progreso del onboarding">
            {[0,1,2,3,4,5,6].map(index => <span key={index} className={`h-1 flex-1 rounded-full ${index <= Math.min(sectionIndex, 6) ? 'bg-cyan-300' : 'bg-[#34343A]'}`} />)}
          </div>
        </div>}

        {error && <div role="alert" aria-live="assertive" className="mb-5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div>}

        <div className="flex-1">
          {step === 'welcome' && <div className="flex min-h-[55vh] flex-col justify-center">
            <p className="mb-3 text-sm font-semibold text-cyan-300">S-TRAINER</p>
            <h1 className="text-3xl font-extrabold tracking-tight">{localGreeting}{person}.</h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-[#C2C2C9]">Vamos a conocerte un poco mejor para que tu entrenador tenga lo necesario para empezar contigo.</p>
            <p className="mt-3 text-sm text-[#85858E]">Solo te preguntaremos lo que realmente necesitamos.</p>
            <button type="button" disabled={saving} onClick={begin} className="mt-10 flex min-h-14 items-center justify-center gap-2 rounded-full bg-cyan-300 px-5 font-bold text-[#101012] disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Empezar</button>
          </div>}

          {step === 'profile' && <div className="space-y-5">
            <PageTitle title="Primero, un poco sobre ti." subtitle="Esta información ayuda a tu entrenador a preparar un trabajo adecuado." />
            <div className="rounded-2xl border border-[#34343A] bg-[#1B1B1F] p-4">
              <button type="button" className="text-left text-sm text-[#D4D4D8] underline decoration-[#62626B] underline-offset-4" onClick={() => { setUsePreferredName(value => !value); if (usePreferredName) setPreferred(''); }}>{usePreferredName ? 'Usar mi nombre habitual' : '¿Prefieres que te llamemos de otra forma?'}</button>
              {usePreferredName && <div className="mt-3"><Input label="Nombre preferido (opcional)" value={preferred} onChange={event => setPreferred(event.target.value)} maxLength={80} autoComplete="nickname" /></div>}
            </div>
            <Input label="Fecha de nacimiento" type="date" value={birthDate} max={today} onChange={event => setBirthDate(event.target.value)} />
            <Input label="Altura (cm)" type="number" inputMode="decimal" min="30" max="300" step="0.1" value={heightCm} onChange={event => setHeightCm(event.target.value)} placeholder="Por ejemplo, 172" />
            <div className="space-y-2"><p className="text-sm font-medium text-[#B5B5BC]">Para personalizar algunas funciones, ¿cuál es tu sexo? <span className="text-[#777780]">(opcional)</span></p>
              <Choice value="male" current={physiologicalSex} label="Hombre" onChoose={setPhysiologicalSex} />
              <Choice value="female" current={physiologicalSex} label="Mujer" onChoose={setPhysiologicalSex} />
              <Choice value="not_provided" current={physiologicalSex} label="Prefiero no indicarlo" onChoose={setPhysiologicalSex} />
            </div>
            <div className="space-y-2"><Input label="Peso actual en kg (opcional)" type="number" inputMode="decimal" min="0.1" max="1000" step="0.1" value={weightKg} onChange={event => setWeightKg(event.target.value)} placeholder="Si lo sabes" />
              <button type="button" onClick={() => setWeightKg('')} className="min-h-10 text-left text-sm text-[#A5A5AD] underline underline-offset-4">No lo sé ahora</button>
            </div>
            <ContinueButton saving={saving} label="Continuar" onClick={saveProfile} />
          </div>}

          {step === 'goal' && <div className="space-y-3">
            <PageTitle title="¿Qué quieres conseguir?" subtitle="Elige lo que más te importa ahora. Podrás hablar de cambios con tu entrenador." />
            {GOALS.map(([value, label]) => <Choice key={value} value={value} current={goal} label={label} onChoose={setGoal} />)}
            {goal === 'other' && <TextArea label="Cuéntanos brevemente cuál es tu objetivo" value={goalOther} maxLength={240} onChange={event => setGoalOther(event.target.value)} />}
            <p className="pt-2 text-sm text-[#B5B5BC]">¿Hay algo más que también te importe? <span className="text-[#777780]">(opcional, hasta 2)</span></p>
            {GOALS.filter(([value]) => value !== goal).map(([value,label]) => <Choice key={value} value={value} current={secondaryGoals.includes(value) ? value : ''} label={label} onChoose={() => toggleSecondary(value)} />)}
            {secondaryGoals.includes('other') && <TextArea label="Otro objetivo secundario" value={secondaryOther} maxLength={240} onChange={event => setSecondaryOther(event.target.value)} />}
            <ContinueButton saving={saving} label="Continuar" onClick={saveGoal} />
          </div>}

          {step === 'activity' && <div className="space-y-3">
            <PageTitle title="Tu día a día" subtitle="Pensando en la mayoría de tus días, ¿cuál se parece más a ti?" />
            {ACTIVITIES.map(([value,label]) => <Choice key={value} value={value} current={activity} label={label} onChoose={setActivity} />)}
            <p className="pt-3 text-sm font-medium text-[#B5B5BC]">¿Sabes aproximadamente cuántos pasos haces al día?</p>
            {([['unknown','No lo sé'],['under_4000','Menos de 4.000'],['4000_8000','4.000–8.000'],['8000_12000','8.000–12.000'],['over_12000','Más de 12.000']] as const).map(([value,label]) => <Choice key={value} value={value} current={stepsBand} label={label} onChoose={setStepsBand} />)}
            <ContinueButton saving={saving} label="Continuar" onClick={saveActivity} />
          </div>}

          {step === 'experience' && <div className="space-y-3">
            <PageTitle title="Tu experiencia" subtitle="¿Has entrenado fuerza alguna vez?" />
            <Choice value="never" current={trainingStatus} label="Nunca" onChoose={value => { setTrainingStatus(value); setExperienceBand(''); setTimeSinceBand(''); }} />
            <Choice value="previously" current={trainingStatus} label="Sí, pero ahora no entreno" onChoose={value => { setTrainingStatus(value); setTimeSinceBand(''); }} />
            <Choice value="currently" current={trainingStatus} label="Sí, entreno actualmente" onChoose={value => { setTrainingStatus(value); setTimeSinceBand(''); }} />
            {trainingStatus !== '' && trainingStatus !== 'never' && <div className="space-y-2 pt-3">
              <p className="text-sm font-medium text-[#B5B5BC]">¿Cuánto tiempo has entrenado fuerza en total?</p>
              {EXPERIENCES.map(([value,label]) => <Choice key={value} value={value} current={experienceBand} label={label} onChoose={setExperienceBand} />)}
            </div>}
            {trainingStatus === 'previously' && <div className="space-y-2 pt-3"><p className="text-sm font-medium text-[#B5B5BC]">¿Cuánto tiempo llevas sin entrenar?</p>{([['under_1_month','Menos de 1 mes'],['1_6_months','1–6 meses'],['6_months_2_years','6 meses–2 años'],['over_2_years','Más de 2 años']] as const).map(([value,label]) => <Choice key={value} value={value} current={timeSinceBand} label={label} onChoose={setTimeSinceBand} />)}</div>}
            <ContinueButton saving={saving} label="Continuar" onClick={saveExperience} />
          </div>}

          {step === 'availability' && <div className="space-y-3">
            <PageTitle title="Ahora vamos con lo práctico." subtitle="¿Cuántos días a la semana podrías dedicar al entrenamiento?" />
            {([['1','1 día'],['2','2 días'],['3','3 días'],['4','4 días'],['5','5 días'],['6_plus','6 o más días']] as const).map(([value,label]) => <Choice key={value} value={value} current={availability} label={label} onChoose={setAvailability} />)}
            <p className="pt-3 text-sm font-medium text-[#B5B5BC]">¿Dónde tienes previsto entrenar?</p>
            {([['gym','Gimnasio'],['home','Casa'],['both','Ambos'],['unknown','Todavía no lo sé']] as const).map(([value,label]) => <Choice key={value} value={value} current={location} label={label} onChoose={setLocation} />)}
            <ContinueButton saving={saving} label="Continuar" onClick={saveAvailability} />
          </div>}

          {step === 'health' && <div className="space-y-3">
            <PageTitle title="Una última pregunta importante" subtitle="¿Hay algo relacionado con tu salud que tu entrenador debería conocer antes de planificar tu entrenamiento?" />
            <Choice value="no" current={healthAnswer} label="No" onChoose={value => { setHealthAnswer(value); setHealthCategories([]); setBodyRegion(''); setHealthDescription(''); }} />
            <Choice value="yes" current={healthAnswer} label="Sí" onChoose={setHealthAnswer} />
            {healthAnswer === 'yes' && <div className="space-y-3 pt-3">
              <p className="text-sm text-[#B5B5BC]">¿Qué tipo de información?</p>
              {HEALTH_CATEGORIES.map(([value,label]) => <button key={value} type="button" aria-pressed={healthCategories.includes(value)} onClick={() => toggleHealthCategory(value)} className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm ${healthCategories.includes(value) ? 'border-cyan-300 bg-cyan-300/10' : 'border-[#34343A] bg-[#1B1B1F]'}`}><span className={`flex h-5 w-5 items-center justify-center rounded border ${healthCategories.includes(value) ? 'border-cyan-300 bg-cyan-300 text-[#101012]' : 'border-[#62626B]'}`}>{healthCategories.includes(value) ? <Check className="h-3.5 w-3.5" /> : null}</span>{label}</button>)}
              {healthCategories.includes('injury_or_discomfort') && <div className="space-y-2"><p className="pt-2 text-sm font-medium text-[#B5B5BC]">¿Qué zona?</p>{BODY_REGIONS.map(([value,label]) => <Choice key={value} value={value} current={bodyRegion} label={label} onChoose={setBodyRegion} />)}</div>}
              <TextArea label="Cuéntanos brevemente qué debería saber tu entrenador (opcional)" value={healthDescription} maxLength={1000} onChange={event => setHealthDescription(event.target.value)} />
              <p className="text-xs leading-relaxed text-[#85858E]">Es una declaración tuya para ayudar a planificar. No es una evaluación médica.</p>
            </div>}
            <ContinueButton saving={saving} label="Continuar" onClick={saveHealth} />
          </div>}

          {step === 'cycle' && <div className="space-y-3">
            <PageTitle title="Un seguimiento opcional" subtitle="Si te resulta útil, puedes registrar tu ciclo en S-TRAINER. Solo tú podrás consultar estos datos." />
            <Choice value="yes" current={cycleChoice} label="Sí, quiero registrarlo" onChoose={setCycleChoice} />
            <Choice value="not_now" current={cycleChoice} label="Ahora no" onChoose={setCycleChoice} />
            {cycleChoice === 'yes' && <div className="space-y-3 pt-3">
              <Input label="Fecha de la última menstruación (opcional)" type="date" max={today} value={lastMenstrualStart} onChange={event => setLastMenstrualStart(event.target.value)} />
              <Input label="Duración habitual del ciclo en días (opcional)" type="number" inputMode="numeric" min="1" max="90" step="1" value={cycleDays} onChange={event => setCycleDays(event.target.value)} placeholder="Si lo sabes" />
              <p className="text-sm font-medium text-[#B5B5BC]">¿Cómo suele ser?</p>
              {([['regular','Regular'],['irregular','Irregular'],['unknown','No lo sé']] as const).map(([value,label]) => <Choice key={value} value={value} current={cyclePattern} label={label} onChoose={setCyclePattern} />)}
              <p className="text-xs leading-relaxed text-[#85858E]">No guardamos una fase menstrual como hecho ni compartimos estos datos con tu entrenador.</p>
            </div>}
            <ContinueButton saving={saving} label="Continuar" onClick={() => saveCycle()} />
          </div>}

          {step === 'review' && <div className="space-y-4">
            <PageTitle title={`Esto es lo que tenemos${person}.`} subtitle="Revísalo antes de terminar. Puedes volver a editar cualquier bloque." />
            <ReviewCard title="Sobre ti" value={[
              snapshot.profile?.preferred_name ? `Nombre preferido: ${snapshot.profile.preferred_name}` : null,
              snapshot.profile?.date_of_birth ? `Nacimiento: ${formatLocalDate(snapshot.profile.date_of_birth)}` : 'Fecha de nacimiento no indicada',
              snapshot.profile?.height_cm == null ? 'Altura no indicada' : `${snapshot.profile.height_cm} cm`,
              snapshot.profile?.physiological_sex ? `Sexo: ${physiologicalSexLabel(snapshot.profile.physiological_sex)}` : null,
            ].filter(Boolean).join(' · ')} onEdit={() => edit('profile')} />
            {snapshot.latestWeight && <ReviewCard title="Peso registrado" value={`${snapshot.latestWeight.weight_kg} kg · ${snapshot.latestWeight.measured_on}`} onEdit={() => edit('profile')} />}
            <ReviewCard title="Objetivo" value={goalLabel(snapshot.goal)} onEdit={() => edit('goal')} />
            <ReviewCard title="Tu día a día" value={`${activityLabel(snapshot.training?.daily_activity_pattern)} · ${stepsLabel(snapshot.training?.daily_steps_band)}`} onEdit={() => edit('activity')} />
            <ReviewCard title="Experiencia" value={experienceLabel(snapshot.training)} onEdit={() => edit('experience')} />
            <ReviewCard title="Disponibilidad" value={`${availabilityLabel(snapshot.training?.availability_days)} · ${locationLabel(snapshot.training?.training_location)}`} onEdit={() => edit('availability')} />
            <ReviewCard title="Salud" value={healthLabel(snapshot.health)} onEdit={() => edit('health')} />
            {cycleEligible && <ReviewCard title="Ciclo" value={cycleLabel(snapshot.menstrual)} onEdit={() => edit('cycle')} />}
            <button type="button" disabled={saving} onClick={complete} className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-cyan-300 px-5 font-bold text-[#101012] disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Todo correcto</button>
          </div>}

          {step === 'done' && <div className="flex min-h-[55vh] flex-col justify-center">
            <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-300/15 text-cyan-300"><Check className="h-6 w-6" /></span>
            <h1 className="text-3xl font-extrabold">Perfecto{person}.</h1>
            <p className="mt-4 text-base leading-relaxed text-[#C2C2C9]">Tu perfil está listo. Tu entrenador ya tiene la información necesaria para empezar a trabajar contigo.</p>
            <button type="button" onClick={() => onFinishOnboarding(snapshot.profile?.preferred_name || null)} className="mt-10 flex min-h-14 items-center justify-center gap-2 rounded-full bg-cyan-300 px-5 font-bold text-[#101012]">Ir a mi inicio <ChevronRight className="h-4 w-4" /></button>
          </div>}
        </div>
      </section>
    </main>
  );
};

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="mb-5"><h1 className="text-2xl font-extrabold tracking-tight">{title}</h1><p className="mt-2 text-sm leading-relaxed text-[#A3A3AB]">{subtitle}</p></div>;
}

function ContinueButton({ saving, label, onClick }: { saving: boolean; label: string; onClick: () => void }) {
  return <button type="button" disabled={saving} onClick={onClick} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-cyan-300 px-5 font-bold text-[#101012] disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{label}</button>;
}

function ReviewCard({ title, value, onEdit }: { title: string; value: string; onEdit: () => void }) {
  return <article className="rounded-2xl border border-[#34343A] bg-[#1B1B1F] p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="text-[11px] font-bold uppercase tracking-wider text-[#85858E]">{title}</h2><p className="mt-2 text-sm leading-relaxed text-[#E2E2E6]">{value}</p></div><button type="button" onClick={onEdit} className="min-h-10 rounded-full px-3 text-xs font-semibold text-cyan-300 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">Editar</button></div></article>;
}

function goalLabel(goal: any) {
  if (!goal?.primary_goal) return 'No indicado';
  const primary = GOALS.find(([key]) => key === goal.primary_goal)?.[1] || goal.primary_goal;
  return `${primary === 'Otro' ? goal.primary_other_text : primary}${goal.secondary_goals?.length ? ` · También: ${goal.secondary_goals.map((key: string) => key === 'other' ? goal.secondary_other_text : GOALS.find(([candidate]) => candidate === key)?.[1]).join(', ')}` : ''}`;
}
function activityLabel(value?: string | null) { return ACTIVITIES.find(([key]) => key === value)?.[1] || 'No indicado'; }
function stepsLabel(value?: string | null) { return ({ unknown: 'Pasos: no lo sé', under_4000: 'Menos de 4.000 pasos', '4000_8000': '4.000–8.000 pasos', '8000_12000': '8.000–12.000 pasos', over_12000: 'Más de 12.000 pasos' } as Record<string,string>)[value || ''] || 'Pasos no indicados'; }
function experienceLabel(training: any) {
  const status = training?.strength_training_status;
  if (status === 'never') return 'Nunca he entrenado fuerza';
  if (!status) return 'No indicado';
  const band = EXPERIENCES.find(([key]) => key === training.experience_band)?.[1] || 'Experiencia no indicada';
  const timeSince = TIME_SINCE.find(([key]) => key === training.time_since_training_band)?.[1] || 'tiempo sin entrenar no indicado';
  return status === 'currently' ? `Entreno actualmente · ${band}` : `Ahora no entreno · ${band} · ${timeSince}`;
}
function availabilityLabel(value?: string | null) { return ({ '1':'1 día/semana','2':'2 días/semana','3':'3 días/semana','4':'4 días/semana','5':'5 días/semana','6_plus':'6+ días/semana' } as Record<string,string>)[value || ''] || 'Días no indicados'; }
function locationLabel(value?: string | null) { return ({ gym:'Gimnasio',home:'Casa',both:'Gimnasio y casa',unknown:'Lugar aún no lo sé' } as Record<string,string>)[value || ''] || 'Lugar no indicado'; }
function physiologicalSexLabel(value?: string | null) { return ({ male: 'Hombre', female: 'Mujer', not_provided: 'Prefiero no indicarlo' } as Record<string,string>)[value || ''] || 'No indicado'; }
function formatLocalDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('es-ES').format(parsed);
}
function cycleLabel(value: any) {
  if (value?.tracking_choice === 'not_now') return 'Ahora no';
  if (value?.tracking_choice !== 'yes') return 'No indicado';
  const facts = ['Registro activado, solo visible para ti'];
  if (value.last_menstrual_start) facts.push(`Última menstruación: ${formatLocalDate(value.last_menstrual_start)}`);
  if (value.usual_cycle_days != null) facts.push(`${value.usual_cycle_days} días habituales`);
  const pattern = ({ regular: 'Regular', irregular: 'Irregular', unknown: 'No lo sé' } as Record<string,string>)[value.cycle_pattern || ''];
  if (pattern) facts.push(pattern);
  return facts.join(' · ');
}
function healthLabel(value: any) {
  if (!value) return 'No hay respuesta guardada';
  if (!value.has_relevant_information) return 'No — declarado por ti';
  const categories = (value.categories || []).map((key: string) => HEALTH_CATEGORIES.find(([candidate]) => candidate === key)?.[1] || key).join(', ');
  return `${categories}${value.body_region ? ` · ${value.body_region}` : ''}${value.description ? ` · ${value.description}` : ''}`;
}
