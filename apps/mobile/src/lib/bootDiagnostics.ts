/**
 * Lightweight boot breadcrumbs.
 *
 * The release APK's cold-start path (fonts → session hook → navigate) has no
 * other on-device visibility; these `[BOOT]` lines surface in `adb logcat` so a
 * hang can be pinned to a stage without attaching a debugger. Intentionally
 * trivial and side-effect-free beyond the log call.
 */
export const bootDiagnostics = {
  log(stage: string, detail?: Record<string, unknown>): void {
    if (detail) {
      console.info(`[BOOT] ${stage}`, JSON.stringify(detail));
    } else {
      console.info(`[BOOT] ${stage}`);
    }
  },
};
