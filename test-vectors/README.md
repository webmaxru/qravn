# Golden test vectors

The files in `test-vectors/golden/` are the stable corpus for the qrrrgh safety engine. Each JSON file is an array of vectors:

```json
{
  "id": "stable-unique-id",
  "payload": "decoded QR payload exactly as text",
  "expectedVerdict": "suspicious",
  "expectedFindings": ["url.shortener"],
  "mustNotContain": ["url.known_malicious"],
  "robustness": false,
  "notes": "Why this case exists and what a failure means."
}
```

`expectedFindings` is the set of codes that must be present. The engine may emit additional findings unless they are listed in `mustNotContain`. Some redirect cases include limitation codes in `expectedFindings` because the limitation is required observable output. Vectors marked `robustness: true` primarily assert that the engine returns a valid verdict and does not crash; they may omit strict finding expectations.

Valid verdicts are `known_malicious`, `suspicious`, `insufficient_evidence`, and `no_known_threat_found`. All finding and limitation codes must exist in `contracts/v1/finding-codes.json`.
