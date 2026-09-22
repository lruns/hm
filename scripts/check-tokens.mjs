// Prove that an edit touched only comments:  node scripts/check-tokens.mjs <git-ref> <file...>
// Transpiles the <git-ref> version and the working-tree version with removeComments and compares
// the output (a raw ts.createScanner pass mis-handles template literals with ${}, hence transpile).
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const [ref, ...files] = process.argv.slice(2)
const strip = (src, f) => ts.transpileModule(src, {
  fileName: f,
  compilerOptions: { removeComments: true, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.Preserve },
}).outputText
let bad = 0
for (const f of files) {
  const a = strip(execSync(`git show ${ref}:${JSON.stringify(f)}`, { encoding: 'utf8', maxBuffer: 1 << 26 }), f)
  const b = strip(readFileSync(f, 'utf8'), f)
  if (a === b) console.log(`same ${f}`)
  else { bad++; console.log(`DIFF ${f}`) }
}
process.exit(bad ? 1 : 0)
