import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '../../components/AppLayout';
import {
  changeUserRole,
  deactivateUser,
  hardDeleteUser,
  listUsers,
  reactivateUser,
  type AdminUser,
} from '../../api/admin.api';
import { useAuthStore } from '../../store/authStore';
import type { UserRole } from '../../types/user';

const ROLES: UserRole[] = ['learner', 'teacher', 'admin'];

export function UserManagementPage() {
  const { t } = useTranslation(['admin', 'common']);
  const me = useAuthStore((s) => s.user);

  const [rows, setRows] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listUsers({ page, limit: 20, search: search || undefined, role: roleFilter || undefined });
      setRows(res.data);
      setTotalPages(res.meta.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          (e as Error).message,
      );
    }
  };

  const roleBadge = (r: UserRole) =>
    r === 'admin' ? 'bg-rose-100 text-rose-700' : r === 'teacher' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700';

  return (
    <AppLayout>
      <h1 className="text-2xl font-extrabold text-slate-800">{t('title')}</h1>
      <p className="mb-6 mt-1 text-slate-500">{t('subtitle')}</p>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
        <select
          className="input max-w-[10rem]"
          value={roleFilter}
          onChange={(e) => {
            setPage(1);
            setRoleFilter(e.target.value as UserRole | '');
          }}
        >
          <option value="">{t('allRoles')}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{error}</p>}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase text-slate-400">
              <th className="px-5 py-3">{t('user')}</th>
              <th className="px-5 py-3">{t('role')}</th>
              <th className="px-5 py-3">{t('status')}</th>
              <th className="px-5 py-3">{t('lastLogin')}</th>
              <th className="px-5 py-3 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const isSelf = u.id === me?.id;
              return (
                <tr key={u.id} className={`border-b border-slate-50 ${u.status === 'deactivated' ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-xs font-extrabold text-brand-700">
                        {(u.displayName[0] ?? '?').toUpperCase()}
                      </span>
                      <div>
                        <div className="font-bold text-slate-800">
                          {u.displayName}
                          {isSelf && <span className="badge ml-1">{t('you')}</span>}
                        </div>
                        <div className="text-xs text-slate-400">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={u.role}
                      disabled={isSelf}
                      onChange={(e) => act(() => changeUserRole(u.id, e.target.value as UserRole))}
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${roleBadge(u.role)} disabled:opacity-60`}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <span className={u.status === 'active' ? 'badge-green' : 'badge-slate'}>
                      {u.status === 'active' ? t('active') : t('deactivated')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-400">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {u.status === 'active' ? (
                        <button className="btn-ghost btn-sm" disabled={isSelf} onClick={() => act(() => deactivateUser(u.id))}>
                          {t('deactivate')}
                        </button>
                      ) : (
                        <button className="btn-soft btn-sm" onClick={() => act(() => reactivateUser(u.id))}>
                          {t('reactivate')}
                        </button>
                      )}
                      <button
                        className="btn-ghost btn-sm text-rose-600 disabled:opacity-40"
                        disabled={isSelf}
                        title={t('delete')}
                        onClick={() => {
                          if (!confirm(t('deleteConfirm', { name: u.displayName }))) return;
                          void act(() => hardDeleteUser(u.id));
                        }}
                      >
                        {t('delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-center gap-4">
        <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          ←
        </button>
        <span className="text-sm font-bold text-slate-500">
          {page} / {totalPages}
        </span>
        <button className="btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          →
        </button>
      </div>
      {loading && <p className="mt-3 text-center text-sm text-slate-400">{t('loading', { ns: 'common' })}</p>}
    </AppLayout>
  );
}
