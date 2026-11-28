# ADR 0001: Retain the current Expo 58 native baseline

Status: accepted as part of the requested audit remediation, 2026-11-09.

The fetched main branch already upgraded the app to Expo SDK 58, React Native 0.88.1
and React 19.3. The engineering file still listed the earlier SDK 57 / RN 0.86 baseline.
Downgrading would reverse the current application/toolchain migration without helping
the security, reminder or usability repairs. This change retains the installed major
baseline and verifies compatible dependencies with Expo tooling.

AGENTS.md owns the baseline values and is updated to match this decision. All other
constraints remain: native Android/iOS only, development builds, Expo Router, TypeScript,
configuration plugins, centralized APIs and no web MVP. Browser previews are design
artifacts only. Native module/config changes require a fresh development build.
