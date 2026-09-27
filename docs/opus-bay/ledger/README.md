# Wave-2 credit ledgers (one file per lane)

Every paid Higgsfield job in wave 2 is logged in its lane's file here, **not** in `src/opus-bay/ASSETS-LEDGER.md`
(that file is append-only and written by the lead, who merges these files into it at the end of wave 2).

| file | lane |
|---|---|
| `w2-C2.md` | C2 · city look, atmosphere, performance (optional art-direction targets) |
| `w2-D2.md` | D2 · landmarks in context, AI meshes, house kit, routes (SAM landmark retakes) |
| `w2-E2.md` | E2 · movement, camera, vehicles, pelican (glide-pelican fallback) |
| `w2-F.md` | F · transit, life, audio (generated SFX, only via H2b) |
| `w2-G1.md` | G1 · map, discovery, fast travel, save v2, HUD |
| `w2-G2.md` | G2 · city content (barks through H2b) |
| `w2-H2b.md` | H2b · painted map, voice barks, murals |

Rules (from `docs/opus-bay/sf-w2-contracts.md` and CLOUD.md):

- Create your file on your first paid job. Use the columns of `ASSETS-LEDGER.md`:
  `| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |`.
- Before a batch: `balance`, and test the CDN (`curl -sS -o /dev/null -w '%{http_code}' <a result url>` must print 200).
  After every batch: `transactions`, then write the rows, a subtotal and the balance before → after.
- The account is shared by parallel lanes: attribute charges by job id and time, never by balance difference alone.
- Starting balance for wave 2: 519.48 credits (owner: all of it may be used; quality first). Plan: `docs/opus-bay/sf-w1-checkpoint.md` §5.3.
