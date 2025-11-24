# How to Use i18n in Your Pages

## Summary

Your i18n is now set up! Here's what works:

- ✅ Middleware redirects `/` → `/en` or `/kr` based on browser locale
- ✅ Middleware redirects `/login` → `/en/login` automatically
- ✅ Translation files are loaded from `messages/en.json` and `messages/kr.json`
- ✅ Users can access different languages via `/en/...` or `/kr/...`

## Using Translations in Client Components

For **client components** (with `'use client'`), use `useTranslations`:

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing'; // Use i18n-aware router

export default function LoginPage() {
  const t = useTranslations('LoginPage');
  const router = useRouter(); // This is locale-aware

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      <button onClick={() => router.push('/home')}>
        {t('goToHome')}
      </button>
    </div>
  );
}
```

## Using Translations in Server Components

For **server components** (default), use `useTranslations` directly:

```tsx
import { useTranslations } from 'next-intl';

export default function SettingsPage() {
  const t = useTranslations('Settings');

  return (
    <div>
      <h1>{t('title')}</h1>
      <ul>
        <li>{t('account')}</li>
        <li>{t('devices')}</li>
        <li>{t('location')}</li>
      </ul>
    </div>
  );
}
```

## Using i18n-Aware Navigation

**IMPORTANT**: Replace all Next.js navigation imports with i18n-aware versions:

### Before (Wrong):
```tsx
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
```

### After (Correct):
```tsx
import { useRouter, usePathname, Link } from '@/i18n/routing';
```

### Example Usage:

```tsx
'use client';

import { Link, useRouter } from '@/i18n/routing';

export function Navigation() {
  const router = useRouter();

  return (
    <nav>
      {/* Links will automatically include locale */}
      <Link href="/devices">Devices</Link>
      <Link href="/settings">Settings</Link>

      {/* Router navigation is locale-aware */}
      <button onClick={() => router.push('/profile')}>
        Profile
      </button>
    </nav>
  );
}
```

## Example: Updating Your Login Page

Here's how you would update parts of your login page:

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing'; // ← Changed!

export default function LoginPage() {
  const t = useTranslations('LoginPage');
  const router = useRouter(); // ← i18n-aware router

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>

      {/* When logged in */}
      {auth?.idToken && (
        <div>
          {t('currentlyLoggedIn')} <b>{auth.profile?.email}</b>
          <button onClick={() => router.replace('/home')}>
            {t('goToHome')}
          </button>
          <button onClick={handleSwitchAccount}>
            {t('switchAccount')}
          </button>
        </div>
      )}
    </div>
  );
}
```

## Language Switching Component

Create a language switcher component:

```tsx
'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLanguage = (newLocale: 'en' | 'kr') => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div>
      <button
        onClick={() => switchLanguage('en')}
        disabled={locale === 'en'}
      >
        English
      </button>
      <button
        onClick={() => switchLanguage('kr')}
        disabled={locale === 'kr'}
      >
        한국어
      </button>
    </div>
  );
}
```

## Adding More Translations

Just add to your JSON files:

**messages/en.json:**
```json
{
  "DevicesPage": {
    "title": "My Devices",
    "addDevice": "Add New Device",
    "noDevices": "No devices found"
  }
}
```

**messages/kr.json:**
```json
{
  "DevicesPage": {
    "title": "내 장치",
    "addDevice": "새 장치 추가",
    "noDevices": "장치가 없습니다"
  }
}
```

Then use in your component:
```tsx
const t = useTranslations('DevicesPage');
<h1>{t('title')}</h1>
```

## Important Notes

1. **Always use i18n routing** - Import from `@/i18n/routing`, not `next/navigation`
2. **Organize translations by page** - Use keys like `LoginPage`, `DevicesPage`, etc.
3. **Test both languages** - Visit `/en/...` and `/kr/...` to verify
4. **Google Sign-In locale** - You can dynamically set the locale on line 156 of login page based on current locale

## Current URLs

- `http://localhost:3000/` → redirects to `/en`
- `http://localhost:3000/login` → redirects to `/en/login`
- `http://localhost:3000/en/login` → English login page
- `http://localhost:3000/kr/login` → Korean login page
- `http://localhost:3000/en/settings` → English settings
- `http://localhost:3000/kr/settings` → Korean settings

The middleware automatically handles all the redirects!
