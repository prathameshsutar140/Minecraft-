# Contributing

Thank you for your interest in improving this project! Contributions such as bug reports, fixes, documentation improvements, and thoughtful feature proposals are welcome.

## Before you start

- Check the existing issues and pull requests to avoid duplicate work.
- For a substantial change, open an issue first to discuss the proposed approach.
- Be respectful and follow the project's [Code of Conduct](CODE_OF_CONDUCT.md).
- Do not contribute assets, textures, sounds, code, or other material unless you have the right to share them.

## Development setup

1. Fork this repository.
2. Clone your fork:
   ```bash
   git clone https://github.com/<your-username>/Minecraft-.git
   cd Minecraft-
   ```
3. Install dependencies:
   ```bash
   bun install
   ```
   You may use `npm install` if you do not use Bun.
4. Start the development server:
   ```bash
   bun run dev
   ```

## Making changes

1. Create a focused branch:
   ```bash
   git switch -c feature/short-description
   ```
2. Keep changes small and consistent with the existing TypeScript, React, and Three.js patterns.
3. Avoid unrelated formatting changes.
4. Update documentation when behaviour, setup, or controls change.
5. Add or update tests when the project has suitable test coverage.

## Verify your changes

Before opening a pull request, run:

```bash
bun run lint
bun run build
```

The current `lint` script performs a TypeScript check (`tsc --noEmit`).

## Pull request checklist

- [ ] The change has a clear purpose and description.
- [ ] The application builds successfully.
- [ ] TypeScript checks pass.
- [ ] UI changes include screenshots or a short recording when useful.
- [ ] Documentation is updated where needed.
- [ ] No secrets, API keys, generated build output, or unrelated files are included.
- [ ] All contributed content is original or appropriately licensed.

## Commit messages

Use short, descriptive commit messages. Suggested prefixes:

- `feat:` new functionality
- `fix:` bug fix
- `docs:` documentation
- `refactor:` code restructuring
- `chore:` maintenance

## Questions

If you are unsure about a proposed change, open an issue with the context and the approach you are considering. Thank you for helping make the project better!
