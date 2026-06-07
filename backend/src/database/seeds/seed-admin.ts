import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../data-source';
import { User } from '../../users/user.entity';

/**
 * Seeds a default admin account. Idempotent: if an active user with the same
 * email already exists, the script leaves it untouched.
 *
 * Credentials are configurable via env (ADMIN_EMAIL / ADMIN_PASSWORD /
 * ADMIN_DISPLAY_NAME) and fall back to sensible local-dev defaults.
 */
async function seedAdmin(): Promise<void> {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@toeic.local').toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? 'Admin12345';
  const displayName = process.env.ADMIN_DISPLAY_NAME ?? 'Administrator';

  await AppDataSource.initialize();
  try {
    const repo = AppDataSource.getRepository(User);
    const existing = await repo
      .createQueryBuilder('u')
      .where('LOWER(u.email) = :email', { email })
      .getOne();

    if (existing) {
      // Make sure the existing account actually has admin rights.
      if (existing.role !== 'admin' || existing.status !== 'active') {
        existing.role = 'admin';
        existing.status = 'active';
        await repo.save(existing);
        console.log(`Updated existing user ${email} -> active admin.`);
      } else {
        console.log(`Admin ${email} already exists. Nothing to do.`);
      }
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const admin = repo.create({
      email,
      passwordHash,
      displayName,
      role: 'admin',
      status: 'active',
      preferredLocale: 'vi',
    });
    await repo.save(admin);
    console.log('Default admin created:');
    console.log(`  email:    ${email}`);
    console.log(`  password: ${password}`);
    console.log('Change this password after first login.');
  } finally {
    await AppDataSource.destroy();
  }
}

seedAdmin().catch((err) => {
  console.error('Admin seed failed:', err);
  process.exit(1);
});
