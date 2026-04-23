# reposhot

CLI que toma un "shot" de tu repositorio local completo y lo empaqueta en un único archivo XML listo para IA.

## Stack

- **Lenguaje:** TypeScript 5.x
- **Runtime:** Node.js 18+
- **Build:** tsup (salida CJS)
- **Testing:** node:test (built-in, sin Jest)
- **Dependencias (prod):** `minimatch` ^10.x, `tiktoken` ^1.x
- **Dependencias (dev):** `typescript`, `tsup`, `@types/node`

## Estructura

```
reposhot/
├── src/
│   ├── cli/
│   │   ├── index.ts          # Entry point, llama a parseArgs y runPack
│   │   ├── args.ts           # Parseo de argv, carga config file
│   │   └── reporter.ts       # Banner, summary, errores con colores ANSI nativos
│   ├── core/
│   │   ├── packer.ts         # Orquestador principal: walk → read → generate → write
│   │   ├── walker.ts         # Recorre el árbol de directorios, aplica filtros
│   │   └── gitignore.ts      # Lee .gitignore, .reposhotignore, matchesPattern()
│   └── output/
│       └── xmlGenerator.ts   # Construye el string XML final
├── test/
│   └── packer.test.ts        # Tests con node:test built-in
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```

## Arquitectura

Flujo de datos:
```
argv → parseArgs() → runPack() → walkDirectory() → readFiles() → generateXml() → writeOutput()
```

- Prioridad de config: `flags argv > reposhot.config.json > defaults`
- walker retorna `{ included: string[], skipped: number }`
- packer detecta binarios por bytes nulos en los primeros 8KB
- Tamaño máximo por archivo: 1MB
- Archivos ordenados alfabéticamente para output determinístico

## Formato XML de salida

El texto introductorio y todo contenido descriptivo dentro del XML debe ser **original**, nunca copiado de otras herramientas. Voz: técnica, concisa, perspectiva de la herramienta.

Estructura:
```xml
This is a snapshot of the repository, packed into a single XML document by
reposhot for AI consumption.

<file_summary>

<purpose>
This document holds a full snapshot of the repository at the time reposhot
was run. Each file's content is included as-is, allowing AI systems to reason
about the entire codebase in a single context window.
</purpose>

<file_format>
The document is structured as follows:
1. This summary block
2. Basic repository metadata
3. A flat directory listing of all included files
4. One entry per file, each with its relative path and full content
</file_format>

<usage_guidelines>
- Treat this file as read-only. Edit the original source files, not this snapshot.
- Use the file path attribute on each entry to identify which file you are reading.
- This snapshot may include sensitive data — handle it accordingly.
</usage_guidelines>

<notes>
- Files excluded by .gitignore or .reposhotignore are not included.
- Binary files are automatically detected and skipped.
- Files larger than 1MB are skipped to keep the snapshot manageable.
- Default ignore patterns (node_modules, dist, .git, etc.) are always applied.
</notes>

<statistics>
  <repository>nombre-del-repo</repository>
  <generated_at>2025-04-23T12:00:00.000Z</generated_at>
  <total_files>12</total_files>
  <total_characters>42800</total_characters>
  <total_tokens>10700</total_tokens>
</statistics>

</file_summary>

<repository_info>
  <n>nombre-del-repo</n>
  <root_path>/ruta/absoluta/al/proyecto</root_path>
</repository_info>

<directory_structure>
src/controllers/userController.js
src/models/user.js
package.json
README.md
</directory_structure>

<files>
Each entry below corresponds to one file in the repository.

<file path="src/controllers/userController.js">
// contenido del archivo escapado en XML
</file>

</files>
```

Conteo de tokens via tiktoken `cl100k_base`. Etiqueta: `<total_tokens>` (no "estimated").

## Flags CLI

| Flag | Alias | Default |
|---|---|---|
| `--output` | `-o` | `reposhot-output.xml` |
| `--include` | `-i` | `""` |
| `--ignore` | — | `""` |
| `--no-gitignore` | — | `false` |
| `--line-numbers` | — | `false` |
| `--remove-comments` | — | `false` |
| `--version` | `-v` | — |
| `--help` | `-h` | — |

## Siempre ignorado (hardcoded)

```
node_modules/ .git/ dist/ build/ coverage/ .next/ .nuxt/ .cache/
__pycache__/ .pytest_cache/ venv/ .venv/ .env .DS_Store Thumbs.db
*.log reposhot-output*.xml
```

Extensiones binarias omitidas automáticamente: imágenes, fuentes, media, archivos comprimidos, compilados.

## Reglas TypeScript

- `strict: true` siempre
- Sin `any` — usar tipos correctos o `unknown`
- Interfaces sobre types para objetos
- Todas las funciones con tipos explícitos (parámetros + retorno)
- Sin default exports excepto en `tsup.config.ts`
- `const` por defecto, `let` solo cuando se necesita reasignación

## Estilo de código

- Sin dependencias de formateo (sin prettier, sin eslint en MVP)
- Indentación: 2 espacios
- Comillas simples
- Comas al final en multilínea
- Largo máximo de línea: 100 caracteres
- Funciones pequeñas y de responsabilidad única
- Comentarios solo para explicar el *por qué*, nunca el *qué*

## Git Flow

Ramas:
- `main` — estable, solo código listo para producción
- `dev` — rama de integración, todo se mergea aquí primero
- `feat/nombre-descriptivo` — nuevas funcionalidades
- `fix/nombre-descriptivo` — corrección de bugs

Reglas:
- Nunca commitear directamente a `main`
- `feat/` y `fix/` siempre desde `dev`
- Mergear `dev` → `main` solo cuando esté estable
- Mensajes de commit en inglés, modo imperativo: `add walker module`, `fix binary detection`
- Cada nueva feature o fix arranca con `git checkout -b feat/nombre` desde `dev` **antes** de escribir código — nunca crear la rama a posteriori con trabajo ya hecho en el working tree

## Reglas de Commits — CRÍTICO

- **Nunca commitear en nombre del usuario** — todos los commits deben ser del dueño del repo
- **Nunca hacer auto-commit** — solo sugerir mensajes de commit, nunca ejecutar `git commit`
- **Nunca hacer push** — nunca ejecutar `git push`
- **Nunca modificar `.gitignore`** sin instrucción explícita
- Formato sugerido: `tipo: descripción corta` (ej: `feat: add xmlGenerator`, `fix: skip files over 1MB`)


## Interfaces base (no inventar variantes)

```typescript
interface ReposhotConfig {
  rootDir: string;
  output: string;          // path o "-" para stdout
  include: string[];
  ignore: string[];
  respectGitignore: boolean;
  showLineNumbers: boolean;
  removeComments: boolean;
}

interface PackResult {
  outputPath: string;
  fileCount: number;
  totalChars: number;
  totalTokens: number;
  skippedCount: number;
  durationMs: number;
}

interface PackedFile {
  path: string;       // ruta absoluta
  relPath: string;    // ruta relativa al rootDir
  content: string;    // contenido ya procesado
}
```

Estas interfaces son el contrato del sistema. No agregar campos, no renombrar, no crear variantes.

## I/O — Síncrono vs Asíncrono

- `walker.ts` — **síncrono**: usar `fs.readdirSync`, `fs.statSync`, `fs.accessSync`
- `gitignore.ts` — **síncrono**: usar `fs.readFileSync`
- `packer.ts` — **asíncrono**: `runPack()` es `async` porque tiktoken puede ser async
- `xmlGenerator.ts` — **síncrono**: pura transformación de strings, sin I/O
- `args.ts` — **síncrono**: usar `fs.readFileSync` para leer config file
- `writeOutput()` — **síncrono**: usar `fs.writeFileSync`

Regla: si una función no necesita await, es síncrona. No usar `fs/promises` en ningún módulo.

## Manejo de errores de sistema de archivos

- Archivo sin permisos de lectura → **omitir**, sumar a `skippedCount`, continuar
- Directorio sin permisos → **omitir**, sumar a `skippedCount`, continuar
- rootDir no existe → **`process.exit(1)`** con mensaje de error via `reporter.printError()`
- Output path no escribible → **`process.exit(1)`** con mensaje de error via `reporter.printError()`
- Archivo supera 1MB → **omitir**, sumar a `skippedCount`, continuar
- Archivo binario detectado → **omitir**, sumar a `skippedCount`, continuar

Regla general: errores de archivos individuales nunca abortan la ejecución. Solo abortan los errores que hacen imposible continuar (rootDir inválido, output no escribible).

## Prohibido

- NO commitear `CLAUDE.md`
- NO instalar dependencias fuera del stack sin aprobación explícita
- NO usar tipo `any`
- NO usar `chalk`, `picocolors`, `commander`, `yargs`, `ora` ni ninguna librería utilitaria de CLI
- NO usar `ESM` — la salida debe ser `CJS` (commonjs)
- NO generar output en formatos distintos a XML en el MVP
- NO agregar features fuera del scope del MVP sin instrucción explícita
- NO ejecutar `git commit`, `git push` ni `git tag` de forma autónoma — solo ejecutarlos si el usuario lo indica explícitamente y siempre mostrando un preview del comando completo para que el usuario autorice antes de correrlo
- NO usar `console.log` en código de producción — usar solo las funciones de `reporter.ts`

## Scope del MVP (no exceder)

Solo estas features existen en v1.0.0:
- Empaquetado de repo local → XML
- Soporte .gitignore + .reposhotignore
- Detección de archivos binarios
- Conteo de tokens (tiktoken)
- Filtros glob include/ignore (minimatch)
- Flags CLI listados arriba
- Soporte reposhot.config.json

Fuera de scope para MVP: repos remotos, output markdown, security checks, compresión, servidor MCP, multi-encoding.

## Comandos

```bash
npm run build        # compilar TS → dist/
npm run dev          # modo watch
npm run test         # correr tests con node:test
npm install -g .     # instalar localmente para pruebas
npx reposhot         # ejecutar sin instalación
```
