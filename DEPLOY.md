# Deploying

## One replica, always

The SSE subscribers, the in-memory `Run`, the inbox and the Claude subprocess
have to live in one process. `numReplicas` is 1 in `railway.json` and must stay
there. A second replica does not double capacity, it splits sessions across two
processes that cannot see each other's streams.

That single-process constraint is also why storage is one SQLite file rather
than Postgres: there is no second process to share a database with, and a
network hop plus a second thing that can be down buys nothing here.

## Railway

1. New service from this repo. It picks up `railway.json` and builds the
   `Dockerfile`.
2. Attach a volume, mount path `/data`. Without it, every deploy loses every
   session.
3. Set the variables:

   | Variable | Value |
   | --- | --- |
   | `ACCESS_PASSCODE` | The shared passcode. Required. |
   | `SESSION_SECRET` | A long random string. Required. |
   | `DATA_DIR` | `/data` |
   | `DEMO_MODE` | `live`, or `cached` for the parachute |
   | `ANTHROPIC_API_KEY` | Server side only. It never appears in a response, an event or a log line. |
   | `MAX_CONCURRENT_RUNS` | `2` to start. Measure RSS before raising it. |
   | `APP_VERSION` | Optional, surfaces in `/healthz` |

4. Health check is `/healthz`, which returns `{ok, version, mode, activeRuns,
   capacity}` and nothing else. No secret is ever in that body.

   It proves the process is listening. It does not prove the app works — see the
   note on the UI build below. After the first deploy, open the URL and sign in
   before calling it done.

## The parachute, on a hosted instance

`DEMO_MODE=cached` sets the whole instance to replay the recording. Changing it
on Railway is a variable change and a redeploy: a new container, a cold start,
and every session in flight orphaned. That is the wrong tool to reach for with
an audience watching.

Prefer the per-session version. The RFP screen has **Play the recorded run**,
and the `F` key does the same thing: the session is created with `mode:
'cached'` and replays the recording through the real stream and the real
renderer, on an instance that stays live. Nothing restarts, nothing already
running is disturbed, and the switch takes one keystroke.

Keep `DEMO_MODE=live` on the hosted instance for that reason. The instance-wide
setting is the fallback for the fallback — the case where something is wrong
with the *agent* rather than with one run, and you want every session cached
without having to remember to press anything.

## Deploy outside demo windows

A deploy restarts the process, and a restart kills every live agent subprocess.
Sessions that were running come back marked `orphaned`, with every section
written so far still readable and exportable. There is no resume: the SDK
session was a subprocess, and rebuilding the tool-side state on top of SDK
session resumption is not this week's work.

Reattaching a browser to a run still executing in the same process does work.
That is what "come back to a session in progress" means here, and the UI should
say exactly that.

## The image

Base is `mcr.microsoft.com/playwright:v1.63.0-noble`. The tag and the
`playwright` dependency are pinned to the same exact version on purpose: the
range in `package.json` used to say `^1.49.1` while the installed library was
`1.63.0`, and an image that drifts from its library fails at the worst moment.
If you bump one, bump both.

Notes on things that are easy to get wrong here:

- `npm ci` runs inside the image. Never copy host `node_modules`: the Agent SDK
  ships a per-platform binary and a Windows host has `win32-x64`. The lockfile
  carries all eight platform packages, so `linux-x64` resolves in the container.
- Do not add `npx playwright install`. The base image already has the browsers.
- `HOME` is set to a writable directory. The Agent SDK subprocess writes there,
  and failing without one looks like an auth error.
- `tsx` is a runtime dependency, not a dev one, because the server's own
  `tsconfig.json` has `noEmit` and the server is run from TypeScript directly.
- **The operator UI does have a build step, and it has its own stage.** Miss it
  and the image ships a working API behind no interface at all — `web/dist`
  does not exist, `existsSync(webDist)` is false, express serves the routes and
  nothing else, and `/healthz` returns `{ok: true}` the entire time. The health
  check cannot catch this. If a deploy comes up and the URL is blank, check
  that `/app/web/dist/index.html` is in the image before looking anywhere else:

  ```bash
  docker run --rm --entrypoint sh <image> -c "ls /app/web/dist"
  ```

  The stage copies exactly two things from outside `web/`: `src/contracts.ts`
  and `start-saudi-kit/brand`. `contracts.ts` imports nothing, which is what
  lets that stage typecheck it without the server's `node_modules` — if someone
  makes it import from `events.ts` again, this build breaks and a laptop build
  will not.
- `better-sqlite3` is native, and pinned to `^12`. Do not bump it to 13 without
  testing on Windows first: 13.0.3 segfaults on Node 22 on win32-x64, which is
  every dev machine here. The base image runs Node 24, so the dependency stage
  also installs a compiler as a fallback for when no prebuilt binary matches;
  that toolchain does not reach the runtime image.

## Running the image locally

```bash
docker build -t startsaudi .
```

```bash
docker run --rm -p 5173:5173 -v startsaudi-data:/data -e DEMO_MODE=cached -e ACCESS_PASSCODE=demo1234 -e SESSION_SECRET=change-me-please-32-chars-min startsaudi
```

Then check the three things that only the container can tell you:

```bash
curl -s localhost:5173/healthz                    # {"ok":true,...}, no secret
curl -s -o /dev/null -w '%{http_code}
' localhost:5173/s/anything   # 200: the SPA fallback
docker run --rm --entrypoint sh startsaudi -c "ls /app/web/dist"      # the UI is in there
```

A restart is worth doing once by hand, because it is the behaviour most likely
to surprise someone: `docker restart` sends SIGTERM, the log says
`SIGTERM: shutting down`, and on the way back up it says how many sessions it
marked `orphaned`. Those sessions keep their sections and stay exportable.

## Checking a deployment

```bash
npm run smoke -- https://your-host
```

It signs in, starts two cached sessions at once, streams both, and fails if
either stream carries the other's id. Run it again after a restart: both
sessions must still list, with their sections intact.
