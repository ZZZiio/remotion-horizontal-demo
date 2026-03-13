# Remotion Project Video Tool Demo

![license](https://img.shields.io/badge/license-Non--Commercial-red)
![platform](https://img.shields.io/badge/platform-Windows-0078D6)
![remotion](https://img.shields.io/badge/Remotion-4.x-ff2d20)

Chinese README: `README.md`

This is an AI‑driven short‑video workflow demo that turns “project link / analysis” into `Remotion JSON` and renders `MP4`.  
Features: auto template/theme matching, stick‑figure animation/image/video blocks, voiceover alignment, and automatic shot choreography.  
Prototype only; may contain bugs. Community contributions are welcome.  
For learning and non-commercial use only; commercial use requires permission.

## Quick Start

1. Install dependencies:
```bash
npm install
```
2. Start panel (recommended) or editor:
```bash
npm run panel
# or
npm run editor
```
3. Configure `.env.local` if you want model calls:
```env
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-5
```
4. One‑shot CLI flow:
```bash
npm run prompt:account
npm run json:account
npm run video:account
```

## FAQ (Short)

**Missing `OPENAI_API_KEY`**  
No key configured or current process cannot read `.env.local`. Use prompt‑only flow. 

**JSON generation failed**  
Common causes: network issues, non‑JSON response, missing prompt file. 

**MP4 render failed**  
Common causes: missing `npm install`, `@remotion/cli` unavailable, output folder not writable, invalid asset URLs. 

## Tech Stack

- Remotion
- React
- TypeScript
- Vite
- Node.js
- PowerShell (Windows scripts)
- Python (voiceover alignment)
- OpenAI API (optional)

## License

Non-Commercial License
