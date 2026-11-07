# Pattern Mind Design: working notes for Claude Code

## What this repo is
Tools for Timea's Etsy shop, Pattern Mind Design. The shop sells hand-drawn Procreate brushes, stamps, and seamless pattern guides. Everything is drawn by hand. No AI.

Timea owns the shop and makes all creative decisions. You build tools that help her write, check, and submit listings and pins. You do not publish anything on her behalf.

## Hard rules
1. Never publish a live listing. The Etsy integration creates draft listings only. Publishing and file uploads stay manual unless Timea explicitly asks for a change.
2. Never invent data. Sales numbers, tag scores, search volumes, and competitor data come from the files in knowledge/ or from Timea. If a value is missing, ask.
3. Never commit secrets. API keys, OAuth tokens, and .env stay out of git. Check .gitignore before any commit.
4. Enforce rules in code, not only in prompts. Anything in rules/ must be checked by src/validate, and the validator must have a test for each rule.
5. Ask before changing approved copy. Timea's bio in knowledge/about-and-bio.md is fixed. Add before or after approved lines. Never rewrite them.

## Voice and copy rules
Read knowledge/voice-rules.md before writing or editing any text. Key points:
- No em dashes anywhere in customer-facing copy.
- Banned words are listed in rules/banned-words.txt.
- Direct, specific, dry. Use exact counts, not "lots of."
- Do not mention Romania or where Timea studied.
- Mention AuDHD only if Timea asks for it in the text.

## Etsy rules (summary; full detail in knowledge/etsy-rules.md)
- Title: max 140 characters. Aim for under 15 words. No repeated phrases.
- Tags: exactly 13, each 20 characters or fewer.
- Shopping basket summary: max 200 characters.
- Do not repeat a category or attribute as a tag.
- Messaging and coupons: see the policy section in knowledge/etsy-rules.md. Do not build features that message past buyers in bulk, or that add buyers to a mailing list without consent.

## Pinterest rules (summary; full detail in knowledge/pin-template.md)
- Image: 1000 x 1500 px, 2:3, under 5 MB.
- Title: max 100 characters.
- Description: 200 to 300 characters. No hashtags.
- Text overlay: 4 to 8 words.
- Tagged topics: up to 10, chosen by Timea in Pinterest's editor. Tools may suggest; Timea selects.

## Tag data
Tag scores come from a third-party tool, not eRank. The scores are in knowledge/tag-scores.md. The anchor tags "digital download" and "instant download" score lowest. Flag them. Don't silently include them.

## Known gaps
- The Etsy API can create draft listings with the listings_w scope. Whether it supports a digital listing type and file uploads is UNVERIFIED. Before building file upload, check the Etsy API reference and record the answer in knowledge/etsy-rules.md.
- Etsy's guidance pages in the research were dated August 2025 to 2026. Re-check before relying on any rule.
- Halloween Botanical count: 140 on the live listing, 150 in some drafts. Ask before changing it.
- Valentine's Day is 14 February 2027. Target launch mid-January 2027.

## Commands
- `npm test`: run the validator tests. Must pass before any commit.
- `npm run validate -- <file.json>`: check a listing or pin JSON from the command line.
- Extension: load unpacked from src/extension/dist in Chrome developer mode.

## Working style
- Build the validator first. It needs no network and is the most useful part.
- Make one change at a time. Run tests after each.
- If a rule is unclear, add the question to knowledge/project-decisions.md under open questions, and ask Timea.
- Keep responses short. Lead with the specific change.
