#ifndef QRAVN_SAFETY_H
#define QRAVN_SAFETY_H

/*
 * C ABI for the QRavn safety core, consumed by the iOS client.
 *
 * The boundary is UTF-8 JSON in both directions, exactly as
 * contracts/v1/assessment.d.ts specifies, so the seam matches the wasm and JNI
 * bindings rather than inventing a third shape.
 *
 * Engines are addressed by an opaque handle into a process-local registry, not
 * by a raw pointer, so a Swift-side bug can leak an engine but can never
 * produce a use-after-free. A handle of 0 is always invalid and inert.
 *
 * Every char * returned by this library is owned by the caller and must be
 * released with qravn_safety_string_free.
 */

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/*
 * Builds an engine from an EngineConfig JSON document and returns its handle.
 * Returns 0 when the engine could not be created. The caller must pass the
 * handle to qravn_safety_engine_destroy exactly once.
 */
int64_t qravn_safety_engine_create(const char *config_json);

/* Releases an engine. Destroying an unknown handle is a no-op. */
void qravn_safety_engine_destroy(int64_t handle);

/*
 * Takes an AssessInput JSON document and returns an Assessment JSON document.
 * An unknown handle or unparsable input yields a cautious insufficient_evidence
 * assessment rather than NULL, so a hostile payload cannot fail its way into
 * looking clean.
 */
char *qravn_safety_engine_assess(int64_t handle, const char *input_json);

/* Returns the engine version string. */
char *qravn_safety_engine_version(void);

/* Releases a string returned by this library. Passing NULL is a no-op. */
void qravn_safety_string_free(char *value);

#ifdef __cplusplus
}
#endif

#endif /* QRAVN_SAFETY_H */
