import { useTranslation } from 'react-i18next';

export function LocaleSwitcher() {
  const { i18n } = useTranslation();

  const change = (lng: string) => {
    void i18n.changeLanguage(lng);
    localStorage.setItem('locale', lng);
  };

  const langs = [
    { code: 'vi', label: 'VI' },
    { code: 'en', label: 'EN' },
  ];

  return (
    <div className="inline-flex rounded-full bg-slate-100 p-0.5 text-xs font-bold">
      {langs.map((l) => (
        <button
          key={l.code}
          onClick={() => change(l.code)}
          className={`rounded-full px-2.5 py-1 transition ${
            i18n.resolvedLanguage === l.code
              ? 'bg-white text-brand-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
