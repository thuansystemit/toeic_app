import { ReactNode } from 'react';
import { LocaleSwitcher } from './LocaleSwitcher';
import { Icon } from './Icon';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 font-extrabold text-slate-800">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-500 text-xl text-white shadow-soft">
              <Icon name="brand" />
            </span>
            TOEIC
          </div>
          <LocaleSwitcher />
        </div>
        <div className="card p-7">
          <h1 className="text-2xl font-extrabold text-slate-800">{title}</h1>
          <p className="mt-1 mb-6 text-sm text-slate-500">{subtitle}</p>
          {children}
        </div>
        <p className="mt-5 text-center text-sm text-slate-500">{footer}</p>
      </div>
    </div>
  );
}
