# Chromium sandbox profile

`chromium-seccomp.json` is derived from the Moby Docker default profile, pinned to commit **6fe7deb1b9fb7c0397a4593480d7d22b9ee8caef**:

https://github.com/moby/profiles/blob/6fe7deb1b9fb7c0397a4593480d7d22b9ee8caef/seccomp/default.json

Modified for SiteEN DAILY on 2026-10-24: add one unconditional allow rule for `clone`, `setns`, `unshare`, and `chroot`. The namespace calls follow the [Playwright Docker sandbox guidance](https://playwright.dev/docs/docker). `chroot` is also required by [Chromium's namespace sandbox](https://chromium.googlesource.com/chromium/src/+/d9d917c05c2a781d58ec15e3182e1dbd24c6530c/sandbox/linux/services/credentials.cc) to drop filesystem access inside its new user namespace. With `cap_drop: ALL`, Moby's capability-conditional rule otherwise denies it. This does not grant container-level `CAP_SYS_CHROOT`; the Linux kernel still checks capabilities in the caller's namespace. The modern Moby base preserves `clone3`'s ENOSYS fallback required by glibc when this syscall is denied. Remaining rules are retained; JSON formatting differs from upstream.

Moby authors. Licensed under Apache-2.0; full license in `moby-profiles-LICENSE`. Playwright guidance is from Microsoft Corporation (license in `playwright-LICENSE`).
The profile retains a deny-by-default policy and allows the user-namespace calls required by Chromium's sandbox. The VPS kernel must also support unprivileged user namespaces. Do not replace it with `seccomp=unconfined`, privileged mode, or `SYS_ADMIN` to work around a failed smoke test.
