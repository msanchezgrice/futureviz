# Futureline

An AI-powered family timeline planning app that helps you visualize and plan your future through interactive timelines, financial projections, and AI-generated day-in-the-life vignettes with photorealistic images.

## Features

- **Interactive Timeline**: Plan years into the future with year cards showing milestones, location, and family ages
- **Financial Planning**: Track savings, growth, and one-off expenses over time
- **Day Composer**: Write or AI-generate day-in-the-life vignettes for 5 different day types:
  - Christmas
  - Thanksgiving
  - Summer Day
  - Spring Day
  - Birthday
- **Vision Board**: Generate 5 photorealistic images showing different moments from your composed days
- **Character Consistency**: Upload family photos to extract physical descriptions for consistent AI-generated images across different years
- **City Planning**: Track where you'll be living over time
- **Local Storage**: All data saved locally in your browser

## Tech Stack

- **Next.js 14.2.5** - React framework
- **TypeScript** - Type-safe development
- **OpenAI GPT-4o** - Text generation and photo analysis
- **Gemini 2.5 Flash Image** - AI image generation
- **Canvas API** - Client-side image compression
- **localStorage** - Browser-based persistence

## Environment Variables

You need to set up the following environment variables:

\`\`\`bash
OPENAI_API_KEY=your_openai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
\`\`\`

### Getting API Keys:

1. **OpenAI API Key**: Get from [platform.openai.com](https://platform.openai.com/api-keys)
   - Used for: Text generation (Day Composer) and photo analysis (GPT-4o Vision)

2. **Gemini API Key**: Get from [ai.google.dev](https://ai.google.dev/)
   - Used for: Image generation (Gemini 2.5 Flash Image)

## Deployment on Vercel

### Environment Variables for Vercel:

Add these to your Vercel project settings:

\`\`\`
OPENAI_API_KEY=sk-proj-...
GEMINI_API_KEY=AIza...
\`\`\`

### Deploy Steps:

1. Push code to GitHub
2. Import repository in Vercel
3. Add environment variables in Project Settings → Environment Variables
4. Deploy!

## Local Development

\`\`\`bash
# Install dependencies
npm install

# Create .env.local file
cp .env.local.example .env.local
# Then add your API keys to .env.local

# Run development server
npm run dev

# Open http://localhost:3000
\`\`\`

## License

MIT
