import { ICONS, type IconName } from './icons';

export function Icon({
  name,
  className = '',
}: {
  name: IconName;
  className?: string;
}) {
  return <i className={`${ICONS[name]} ${className}`.trim()} aria-hidden="true" />;
}
