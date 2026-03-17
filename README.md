# Shonya Films

## Local development

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## GitHub Pages deployment

The project is already configured for GitHub Pages:

- static export via `output: 'export'`
- automatic `basePath` for project pages repositories
- GitHub Actions workflow in `.github/workflows/deploy-pages.yml`

### What URL you will get

- if the repository name is `username.github.io`, the site will open at `https://username.github.io/`
- if the repository name is anything else, the site will open at `https://username.github.io/repository-name/`

### What to do in GitHub

1. Push this project to a GitHub repository.
2. Open `Settings -> Pages`.
3. In `Build and deployment`, choose `GitHub Actions` as the source.
4. Push to `main` or run the workflow manually from `Actions`.
5. After the workflow finishes, GitHub Pages will publish the contents of `out/`.

### Important notes

- GitHub Pages is static hosting. This project works because film data is loaded client-side in the browser.
- The workflow uses `npm ci` and `npm run build`.
- `public/.nojekyll` is included to avoid Jekyll interfering with `_next` assets.

## Useful commands

```bash
npm run build
npm run start -- --port 3000
```
