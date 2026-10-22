with open('apps/web/src/pages/HorsesPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Determine line ending
crlf = '\r\n' in content
NL = '\r\n' if crlf else '\n'

# 1. Add TFunction import
old_i = f"import {{ useTranslation }} from 'react-i18next';{NL}"
new_i = f"import {{ useTranslation, type TFunction }} from 'react-i18next';{NL}"
if old_i not in content:
    # try LF-only version
    old_i = "import { useTranslation } from 'react-i18next';\n"
    new_i = "import { useTranslation, type TFunction } from 'react-i18next';\n"
assert old_i in content, f"import not found: {repr(old_i)}"
content = content.replace(old_i, new_i, 1)

# 2. Add helper after imports, before 'type Filter'
old_f = f"type Filter = 'all' | 'locked' | 'injured' | 'mon';{NL}"
if old_f not in content:
    old_f = "type Filter = 'all' | 'locked' | 'injured' | 'mon';\n"
assert old_f in content, f"type Filter not found"
helper = (
    f"/** Translate the \"Incident: \" prefix added by the backend when locking a horse. */{NL}"
    f"function formatLockReason(reason: string | null | undefined, t: TFunction): string {{{NL}"
    f"  if (!reason) return t('horsePage.locked');{NL}"
    f"  const prefix = 'Incident: ';{NL}"
    f"  if (reason.startsWith(prefix)) {{{NL}"
    f"    return `${{t('horsePage.incidentPrefix')}}: ${{reason.slice(prefix.length)}}`;{NL}"
    f"  }}{NL}"
    f"  return reason;{NL}"
    f"}}{NL}{NL}"
)
content = content.replace(old_f, helper + old_f, 1)

# 3. Replace lockReason in HorseCard (card view)
old1 = "{h.locked && <LockBadge>{h.lockReason ?? t('horsePage.locked')}</LockBadge>}"
new1 = "{h.locked && <LockBadge>{formatLockReason(h.lockReason, t)}</LockBadge>}"
if old1 not in content:
    print("WARN card lockReason not found, skipping")
else:
    content = content.replace(old1, new1, 1)

# 4. Replace lockReason in table row
old2 = '{h.locked ? <LockBadge>{h.lockReason ?? t(\'horsePage.locked\')}</LockBadge> : <span className="cap">—</span>}'
new2 = '{h.locked ? <LockBadge>{formatLockReason(h.lockReason, t)}</LockBadge> : <span className="cap">—</span>}'
if old2 not in content:
    print("WARN table lockReason not found, skipping")
else:
    content = content.replace(old2, new2, 1)

with open('apps/web/src/pages/HorsesPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")

