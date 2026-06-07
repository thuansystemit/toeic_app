import { fileUrl } from '../api/files.api';
import type { AttemptStimulus } from '../types/attempt';
import { AudioPlayer } from './AudioPlayer';

type Mode = 'full' | 'practice' | 'review';

function One({
  stimulus,
  attemptId,
  mode,
}: {
  stimulus: AttemptStimulus;
  attemptId: string;
  mode: Mode;
}) {
  if (stimulus.type === 'audio' && stimulus.storageKey) {
    return <AudioPlayer stimulus={stimulus} attemptId={attemptId} mode={mode} />;
  }
  if (stimulus.type === 'image' && stimulus.storageKey) {
    return (
      <img
        src={fileUrl(stimulus.storageKey)}
        alt="question"
        className="max-h-80 w-full rounded-2xl border border-slate-100 object-contain"
      />
    );
  }
  if (stimulus.passageText) {
    return (
      <div className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
        {stimulus.passageText}
      </div>
    );
  }
  return null;
}

export function StimulusDisplay({
  stimuli,
  attemptId,
  mode,
}: {
  stimuli: AttemptStimulus[];
  attemptId: string;
  mode: Mode;
}) {
  if (!stimuli || stimuli.length === 0) return null;
  return (
    <div className="mb-3 flex flex-col gap-3">
      {stimuli.map((s) => (
        <One key={s.id} stimulus={s} attemptId={attemptId} mode={mode} />
      ))}
    </div>
  );
}
