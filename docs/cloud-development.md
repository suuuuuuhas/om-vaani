# Work on Om Vaani from another computer

The private GitHub repository https://github.com/suuuuuuhas/om-vaani is the source of truth. Vercel hosts the running app; Supabase stores hosted drafts and generated audio. Local SQLite records and credentials are excluded from Git.

## In a browser with GitHub Codespaces

Open the repository, choose **Code → Codespaces → Create codespace**. The included dev container selects Python 3.12, installs the development dependencies, and forwards port 8000. Codespaces can use your GitHub allowance or billing; creating a running workspace is left to you.

In its terminal:

```bash
python -m pytest -q
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-access-log --no-proxy-headers
```

Open the forwarded port from the Ports panel. Keep its visibility private. The developer setup form intentionally rejects forwarded requests. For live provider tests, add `GNANI_STT_API_KEY`, `GNANI_TTS_API_KEY` and `GEMINI_API_KEY` as repository-scoped Codespaces secrets in GitHub settings, then restart the codespace. Alternatively, create the ignored `.env.keys.local` inside the private workspace. Unit tests work without keys.

Do not point development at the production database by default. SQLite in the codespace gives you separate test data. The bundled imageio-ffmpeg binary handles speech decoding when system ffmpeg is absent.

## On another laptop

Clone the private repository using your authenticated GitHub account. Create a Python virtual environment, install `requirements-dev.txt`, then run the same Uvicorn command on `127.0.0.1`. On Windows, `scripts/start.ps1` handles setup and startup. Add your existing AI keys through the laptop-only `/setup` page.

## Deploy a reviewed change

Commit and push your code, authenticate Vercel CLI to the approved account, and link the existing `om-vaani` project in `suhas-projects13`:

```bash
npx vercel link --yes --project om-vaani --scope suhas-projects13
npx vercel deploy --prod --yes --scope suhas-projects13
```

Production secrets remain encrypted in Vercel and do not need to be committed or copied to each checkout. CLI deployment is the current workflow; automatic GitHub deployment is not assumed. `scripts/configure_vercel.py` is an operator tool for the original laptop because its ignored `data/deploy-secrets.json` is deliberately absent from GitHub.

The managed Cloud Environment plugin is separate from Codespaces. This chat currently has no exposed managed cloud executor; the dev-container configuration makes the source portable without claiming that such an executor is attached.
