// promptfoo prompt builder for the ML / deterministic features.
// The "prompt" handed to the Python provider is just the JSON spec it parses:
//   { feature: "<name>", payload: {<service request fields>} }
export default async function ({ vars }) {
  return JSON.stringify({ feature: vars.feature, payload: vars.payload });
}
