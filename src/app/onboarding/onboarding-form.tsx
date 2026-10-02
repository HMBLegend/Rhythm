"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { z } from "zod";
import {
  AVOID,
  commitmentsStep,
  EQUIPMENT,
  EXPERIENCE_LEVELS,
  GOALS,
  goalStep,
  MAX_COMMITMENTS,
  MAX_WINDOWS,
  onboardingSchema,
  type OnboardingInput,
  preferencesStep,
  sessionsStep,
  windowsStep,
} from "@/lib/scheduling/routine";
import {
  AVOID_LABELS,
  DAY_NAMES,
  dayName,
  EQUIPMENT_LABELS,
  EXPERIENCE_LABELS,
  GOAL_LABELS,
  label,
} from "./labels";

// Answers so far. Nothing is saved until the review screen's confirm button,
// so leaving or refreshing the page starts over.
type Draft = Omit<OnboardingInput, "goal" | "experience" | "timezone"> & {
  goal: OnboardingInput["goal"] | null;
  experience: OnboardingInput["experience"] | null;
};

const EMPTY: Draft = {
  goal: null,
  experience: null,
  sessionsPerWeek: 3,
  sessionLengthMin: 45,
  commitments: [],
  windows: [],
  equipment: [],
  avoid: [],
  avoidNote: "",
};

// Each screen validates its own fields with the same schema the server uses.
const STEPS: {
  title: string;
  schema: z.ZodType;
  pick: (draft: Draft) => unknown;
}[] = [
  {
    title: "What are you training for?",
    schema: goalStep,
    pick: ({ goal, experience }) => ({ goal, experience }),
  },
  {
    title: "How much can you train?",
    schema: sessionsStep,
    pick: ({ sessionsPerWeek, sessionLengthMin }) => ({
      sessionsPerWeek,
      sessionLengthMin,
    }),
  },
  {
    title: "What's fixed in your week?",
    schema: commitmentsStep,
    pick: ({ commitments }) => ({ commitments }),
  },
  {
    title: "When could you train?",
    schema: windowsStep,
    pick: ({ windows }) => ({ windows }),
  },
  {
    title: "Equipment and limits",
    schema: preferencesStep,
    pick: ({ equipment, avoid, avoidNote }) => ({
      equipment,
      avoid,
      avoidNote,
    }),
  },
];

const SESSION_LENGTHS = [20, 30, 45, 60, 75, 90];

// Field path ("commitments.0.end") -> first error message for it.
type Errors = Record<string, string>;

function toErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Errors = {};
  for (const issue of issues) {
    const path = issue.path.map(String).join(".");
    errors[path] ??= issue.message;
  }
  return errors;
}

function toggle<T>(list: readonly T[], value: T) {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

type StepProps = {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
  errors: Errors;
};

export function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isReview = step === STEPS.length;
  const update = (patch: Partial<Draft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  function goTo(next: number) {
    setErrors({});
    setSaveError(null);
    setStep(next);
    window.scrollTo(0, 0);
  }

  function onNext() {
    const current = STEPS[step]!;
    const result = current.schema.safeParse(current.pick(draft));
    if (!result.success) {
      setErrors(toErrors(result.error.issues));
      return;
    }
    goTo(step + 1);
  }

  async function onConfirm() {
    const result = onboardingSchema.safeParse({
      ...draft,
      timezone: browserTimeZone(),
    });
    if (!result.success) {
      // Shouldn't happen after per-step checks, but send the user to the
      // first screen with a problem rather than failing silently.
      const index = STEPS.findIndex(
        (s) => !s.schema.safeParse(s.pick(draft)).success,
      );
      goTo(index === -1 ? 0 : index);
      return;
    }

    setSaving(true);
    setSaveError(null);
    let response: Response;
    try {
      response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(result.data),
      });
    } catch {
      setSaving(false);
      setSaveError("Couldn't reach the server. Check your connection.");
      return;
    }

    if (response.ok || response.status === 409) {
      router.replace("/week");
      router.refresh();
      return;
    }
    if (response.status === 401) {
      router.replace("/login?next=%2Fonboarding");
      return;
    }
    setSaving(false);
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setSaveError(
      body?.error ?? "Couldn't save your answers. Please try again.",
    );
  }

  const props: StepProps = { draft, update, errors };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Step {step + 1} of {STEPS.length + 1}
        </p>
        <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-zinc-900 transition-all dark:bg-white"
            style={{ width: `${((step + 1) / (STEPS.length + 1)) * 100}%` }}
          />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isReview ? "Check your answers" : STEPS[step]!.title}
        </h1>
      </div>

      {step === 0 && <GoalStep {...props} />}
      {step === 1 && <SessionsStep {...props} />}
      {step === 2 && <CommitmentsStep {...props} />}
      {step === 3 && <WindowsStep {...props} />}
      {step === 4 && <PreferencesStep {...props} />}
      {isReview && <Review draft={draft} onEdit={goTo} />}

      {saveError && <ErrorText>{saveError}</ErrorText>}

      <div className="mt-auto flex gap-3 pt-4">
        {step > 0 && (
          <button
            type="button"
            onClick={() => goTo(step - 1)}
            disabled={saving}
            className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 font-medium dark:border-zinc-700"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={isReview ? onConfirm : onNext}
          disabled={saving}
          className="flex-1 rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {isReview ? (saving ? "Saving…" : "Confirm and save") : "Next"}
        </button>
      </div>
    </main>
  );
}

function GoalStep({ draft, update, errors }: StepProps) {
  return (
    <>
      <Group legend="Main goal" error={errors.goal}>
        {GOALS.map((goal) => (
          <Chip
            key={goal}
            selected={draft.goal === goal}
            onClick={() => update({ goal })}
          >
            {GOAL_LABELS[goal]}
          </Chip>
        ))}
      </Group>
      <Group legend="Experience" error={errors.experience}>
        {EXPERIENCE_LEVELS.map((experience) => (
          <Chip
            key={experience}
            selected={draft.experience === experience}
            onClick={() => update({ experience })}
          >
            {EXPERIENCE_LABELS[experience]}
          </Chip>
        ))}
      </Group>
    </>
  );
}

function SessionsStep({ draft, update, errors }: StepProps) {
  return (
    <>
      <Group legend="Sessions per week" error={errors.sessionsPerWeek}>
        {[1, 2, 3, 4, 5, 6, 7].map((count) => (
          <Chip
            key={count}
            selected={draft.sessionsPerWeek === count}
            onClick={() => update({ sessionsPerWeek: count })}
          >
            {count}
          </Chip>
        ))}
      </Group>
      <Group legend="Minutes per session" error={errors.sessionLengthMin}>
        {SESSION_LENGTHS.map((minutes) => (
          <Chip
            key={minutes}
            selected={draft.sessionLengthMin === minutes}
            onClick={() => update({ sessionLengthMin: minutes })}
          >
            {minutes}
          </Chip>
        ))}
      </Group>
    </>
  );
}

function CommitmentsStep({ draft, update, errors }: StepProps) {
  const { commitments } = draft;
  const change = (
    index: number,
    patch: Partial<Draft["commitments"][number]>,
  ) =>
    update({
      commitments: commitments.map((c, i) =>
        i === index ? { ...c, ...patch } : c,
      ),
    });

  return (
    <>
      <p className="text-zinc-600 dark:text-zinc-400">
        Work, school runs, classes: anything you can&apos;t train during. Skip
        this if nothing is fixed.
      </p>
      {commitments.map((commitment, i) => (
        <fieldset
          key={i}
          className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <legend className="sr-only">Commitment {i + 1}</legend>
          <Field label="Name" error={errors[`commitments.${i}.label`]}>
            <input
              value={commitment.label}
              onChange={(e) => change(i, { label: e.target.value })}
              maxLength={50}
              placeholder="e.g. Work"
              className={inputClass}
            />
          </Field>
          <Group legend="Days" error={errors[`commitments.${i}.days`]}>
            {DAY_NAMES.map((name, d) => (
              <Chip
                key={name}
                small
                selected={commitment.days.includes(d + 1)}
                onClick={() =>
                  change(i, {
                    days: toggle(commitment.days, d + 1).sort((a, b) => a - b),
                  })
                }
              >
                {name}
              </Chip>
            ))}
          </Group>
          <TimeRange
            start={commitment.start}
            end={commitment.end}
            error={
              errors[`commitments.${i}.end`] ?? errors[`commitments.${i}.start`]
            }
            onChange={(patch) => change(i, patch)}
          />
          <label className="flex items-center gap-3 py-1">
            <input
              type="checkbox"
              checked={commitment.movable}
              onChange={(e) => change(i, { movable: e.target.checked })}
              className="size-5"
            />
            I could move this if needed
          </label>
          <RemoveButton
            onClick={() =>
              update({ commitments: commitments.filter((_, j) => j !== i) })
            }
          />
        </fieldset>
      ))}
      {errors.commitments && <ErrorText>{errors.commitments}</ErrorText>}
      {commitments.length < MAX_COMMITMENTS && (
        <AddButton
          onClick={() =>
            update({
              commitments: [
                ...commitments,
                {
                  label: "",
                  days: [],
                  start: "09:00",
                  end: "17:00",
                  movable: false,
                },
              ],
            })
          }
        >
          Add a commitment
        </AddButton>
      )}
    </>
  );
}

function WindowsStep({ draft, update, errors }: StepProps) {
  const { windows } = draft;
  const change = (index: number, patch: Partial<Draft["windows"][number]>) =>
    update({
      windows: windows.map((w, i) => (i === index ? { ...w, ...patch } : w)),
    });

  return (
    <>
      <p className="text-zinc-600 dark:text-zinc-400">
        Times you could usually fit a workout in. Add more than you need so
        there&apos;s room to re-plan.
      </p>
      {windows.map((slot, i) => (
        <fieldset
          key={i}
          className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <legend className="sr-only">Training time {i + 1}</legend>
          <Field label="Day">
            <select
              value={slot.day}
              onChange={(e) => change(i, { day: Number(e.target.value) })}
              className={inputClass}
            >
              {DAY_NAMES.map((name, d) => (
                <option key={name} value={d + 1}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <TimeRange
            start={slot.start}
            end={slot.end}
            error={errors[`windows.${i}.end`] ?? errors[`windows.${i}.start`]}
            onChange={(patch) => change(i, patch)}
          />
          <RemoveButton
            onClick={() =>
              update({ windows: windows.filter((_, j) => j !== i) })
            }
          />
        </fieldset>
      ))}
      {errors.windows && <ErrorText>{errors.windows}</ErrorText>}
      {windows.length < MAX_WINDOWS && (
        <AddButton
          onClick={() =>
            update({
              windows: [...windows, { day: 1, start: "18:00", end: "19:00" }],
            })
          }
        >
          Add a time
        </AddButton>
      )}
    </>
  );
}

function PreferencesStep({ draft, update, errors }: StepProps) {
  return (
    <>
      <Group
        legend="Equipment you can use (none is fine)"
        error={errors.equipment}
      >
        {EQUIPMENT.map((item) => (
          <Chip
            key={item}
            small
            selected={draft.equipment.includes(item)}
            onClick={() => update({ equipment: toggle(draft.equipment, item) })}
          >
            {EQUIPMENT_LABELS[item]}
          </Chip>
        ))}
      </Group>
      <Group legend="Anything to avoid?" error={errors.avoid}>
        {AVOID.map((item) => (
          <Chip
            key={item}
            small
            selected={draft.avoid.includes(item)}
            onClick={() => update({ avoid: toggle(draft.avoid, item) })}
          >
            {AVOID_LABELS[item]}
          </Chip>
        ))}
      </Group>
      <Field label="Anything else? (optional)" error={errors.avoidNote}>
        <textarea
          value={draft.avoidNote}
          onChange={(e) => update({ avoidNote: e.target.value })}
          maxLength={200}
          rows={3}
          placeholder="e.g. sore left knee"
          className={inputClass}
        />
      </Field>
    </>
  );
}

function Review({
  draft,
  onEdit,
}: {
  draft: Draft;
  onEdit: (step: number) => void;
}) {
  const list = (items: string[]) => (items.length ? items.join(", ") : "None");
  return (
    <div className="flex flex-col gap-4">
      <ReviewItem title="Goal" onEdit={() => onEdit(0)}>
        {draft.goal && GOAL_LABELS[draft.goal]},{" "}
        {draft.experience && EXPERIENCE_LABELS[draft.experience].toLowerCase()}
      </ReviewItem>
      <ReviewItem title="Training" onEdit={() => onEdit(1)}>
        {draft.sessionsPerWeek} × {draft.sessionLengthMin} min a week
      </ReviewItem>
      <ReviewItem title="Fixed commitments" onEdit={() => onEdit(2)}>
        {draft.commitments.length === 0
          ? "None"
          : draft.commitments.map((c, i) => (
              <span key={i} className="block">
                {c.label.trim()}: {c.days.map(dayName).join(", ")} {c.start}–
                {c.end}
                {c.movable && " (movable)"}
              </span>
            ))}
      </ReviewItem>
      <ReviewItem title="Could train" onEdit={() => onEdit(3)}>
        {draft.windows.map((w, i) => (
          <span key={i} className="block">
            {dayName(w.day)} {w.start}–{w.end}
          </span>
        ))}
      </ReviewItem>
      <ReviewItem title="Equipment and limits" onEdit={() => onEdit(4)}>
        <span className="block">
          Equipment:{" "}
          {list(draft.equipment.map((e) => label(EQUIPMENT_LABELS, e)))}
        </span>
        <span className="block">
          Avoid: {list(draft.avoid.map((a) => label(AVOID_LABELS, a)))}
        </span>
        {draft.avoidNote.trim() && (
          <span className="block">Note: {draft.avoidNote.trim()}</span>
        )}
      </ReviewItem>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Times are in your time zone ({browserTimeZone()}).
      </p>
    </div>
  );
}

// Small building blocks.

const inputClass =
  "w-full rounded-lg border border-zinc-300 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900";

function Chip({
  selected,
  onClick,
  small,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-full border font-medium ${small ? "min-h-11 px-3 text-sm" : "min-h-12 px-4"} ${
        selected
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
          : "border-zinc-300 dark:border-zinc-700"
      }`}
    >
      {children}
    </button>
  );
}

function Group({
  legend,
  error,
  children,
}: {
  legend: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
      {error && <ErrorText>{error}</ErrorText>}
    </fieldset>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
      {label}
      {children}
      {error && <ErrorText>{error}</ErrorText>}
    </label>
  );
}

function TimeRange({
  start,
  end,
  error,
  onChange,
}: {
  start: string;
  end: string;
  error?: string;
  onChange: (patch: { start?: string; end?: string }) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-3">
        <Field label="From">
          <input
            type="time"
            value={start}
            onChange={(e) => onChange({ start: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="To">
          <input
            type="time"
            value={end}
            onChange={(e) => onChange({ end: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

function ReviewItem({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
      <div>
        <h2 className="text-sm text-zinc-600 dark:text-zinc-400">{title}</h2>
        <div>{children}</div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="min-h-11 px-2 text-sm underline"
        aria-label={`Edit ${title.toLowerCase()}`}
      >
        Edit
      </button>
    </div>
  );
}

function AddButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-dashed border-zinc-400 px-4 py-3 font-medium dark:border-zinc-600"
    >
      + {children}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start py-2 text-sm text-red-600 underline dark:text-red-400"
    >
      Remove
    </button>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {children}
    </p>
  );
}
