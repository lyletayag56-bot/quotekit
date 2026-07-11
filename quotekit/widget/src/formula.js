import { Parser } from 'expr-eval';

// Customers write formulas like `(sqft * rate) * finish + base_fee`.
// expr-eval parses to an AST and evaluates against a scope object — no
// JavaScript execution, no access to anything outside the scope we pass.
const parser = new Parser({
  operators: {
    assignment: false,   // no `x = ...`
    concatenate: false,  // no string building
    in: false,
    logical: true,       // and/or for e.g. tiered pricing
    comparison: true,    // >, <, == for conditional pricing
    conditional: true,   // cond ? a : b
  },
});

// Compile once per widget mount. `allowedNames` is the set of field keys +
// constant names from the calculator config; any other identifier is an
// author error we surface immediately instead of failing at quote time.
export function compileFormula(formula, allowedNames) {
  const expr = parser.parse(formula);
  const unknown = expr
    .variables({ withMembers: true })
    .filter((name) => !allowedNames.has(name));
  if (unknown.length) {
    throw new Error(`Unknown variable(s) in formula: ${unknown.join(', ')}`);
  }
  return function evaluate(scope) {
    const value = expr.evaluate(scope);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('Formula did not produce a number');
    }
    return value;
  };
}
