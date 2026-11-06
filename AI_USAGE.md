# AI usage

ETHGlobal asks every team to say where and how AI tools were used. This log is updated with each feature.

## Planning (before the event)
Pre-event planning documents were written with Claude (Anthropic): product spec, architecture, data model,
integration notes, wireframes, prize requirements and checklists. They are in `docs/spec/` as the spec this
build follows. An earlier prototype of the same idea (named STREETLAYER) was explored before the event;
none of its code is in this repository.

## During the hackathon
| Time (IST) | Tool | What it did | Files |
|---|---|---|---|
| Nov 5, 21:05 | Claude | Repo scaffold, monorepo config | root files |
| Nov 5, 21:15 | Claude | Shared core: types, rails, demo data, mock services | `packages/core` |
| Nov 5, 21:35 | Claude | Web app shell, design tokens, landing page with video hero | `apps/web` |
| Nov 5, 21:50 | Claude | Explore: offline street map, stall list, stories, filters | `apps/web/src/screens/customer/Explore.tsx`, `components/*` |
| Nov 6, 22:15 | Claude | Role chooser + sign-in first screen (web + phone), MetaMask top-up panel | `apps/web/src/screens/Start.tsx`, `apps/mobile/src/screens/Welcome.tsx` |
| Nov 6, 22:40 | Claude | Gemini inside WhatsApp (photo → listing → publish, free-text → command) + offline test | `apps/web/api/whatsapp.ts`, `api/_lib/gemini.ts`, `api/_test/` |
| Nov 6, 22:40 | Google Gemini (runtime) | In the product: reads stall photos/text and WhatsApp messages; only drafts or picks a command, never moves money | `api/ai.ts`, `api/whatsapp.ts` |

Human decisions: product idea, features, prize selection, design direction, vendor research, testing and review.
