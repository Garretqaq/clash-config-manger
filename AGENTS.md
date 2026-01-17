# AGENTS.md - Clash Config Manage Development Guide

## Overview

This is a Next.js 14 project with TypeScript for managing Clash configuration files. It includes node management, proxy groups, subscriptions, and sharing capabilities.

## Build Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on http://localhost:3000 |
| `npm run build` | Build for production (outputs to `.next/standalone`) |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint for code quality |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:studio` | Open Prisma Studio UI |
| `npm run db:generate` | Generate Prisma client |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth pages (login)
│   ├── (dashboard)/       # Dashboard pages
│   ├── (public)/          # Public pages (share links)
│   └── api/               # API routes
├── components/
│   ├── ui/               # Shadcn/ui style components
│   ├── layout/           # Layout components
│   └── ...               # Feature components
├── lib/                   # Utilities and services
│   ├── db.ts             # Prisma client
│   ├── utils.ts          # Helper functions (cn, formatDate, etc.)
│   ├── types.ts          # TypeScript interfaces
│   ├── clash-parser.ts   # Clash config parser
│   ├── clash-generator.ts# Config generator
│   └── ...
├── hooks/                 # Custom React hooks
└── contexts/              # React contexts
```

## Code Style Guidelines

### TypeScript

- Enable `strict: true` in tsconfig.json
- Use explicit types for function parameters and return values
- Define interfaces for all data structures (see `src/lib/types.ts`)
- Use discriminated unions for variant types

### Naming Conventions

| Type | Convention | Examples |
|------|------------|----------|
| Files | kebab-case | `clash-parser.ts`, `use-theme.ts` |
| Components | PascalCase | `NodeCard.tsx`, `ConfigViewer.tsx` |
| Interfaces | PascalCase | `ProxyNode`, `ClashConfig` |
| Variables/functions | camelCase | `formatDate`, `nodeConnection` |
| Constants | UPPER_SNAKE_CASE | `CONNECTION_STATUS_COLORS` |

### Imports

```typescript
// Relative imports for same-level or child modules
import { something } from './utils'

// Absolute imports for @/* path aliases (src/*)
import { prisma } from '@/lib/db'
import { cn } from '@/lib/utils'

// Order: React → external libs → absolute imports → relative imports
```

### Utility Functions

Use the `cn()` utility for Tailwind class merging:

```typescript
import { cn } from '@/lib/utils'

function MyComponent({ className }: { className?: string }) {
  return <div className={cn("base-class", className)} />
}
```

Available utilities in `src/lib/utils.ts`:
- `cn()` - Merge Tailwind classes
- `formatDate()` - Format date in zh-CN timezone
- `formatDateTime()` - Full datetime format in zh-CN

### Component Pattern

Follow this structure for React components:

```typescript
import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface ComponentProps {
  className?: string
}

export function Component({ className }: ComponentProps) {
  // State
  const [state, setState] = useState(false)

  // Callbacks with useCallback
  const handleAction = useCallback(() => {
    // logic
  }, [dependencies])

  return <div className={cn("", className)}>{/* JSX */}</div>
}
```

### API Routes

Follow this pattern for Next.js route handlers:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/resource
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const param = searchParams.get('param')

    const data = await prisma.model.findMany({ /* ... */ })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Operation failed:', error)
    return NextResponse.json({ error: 'Message' }, { status: 500 })
  }
}
```

Error handling: return `{ error: 'message' }` with appropriate HTTP status code.

### CSS/Tailwind

- Use `hsl(var(--color))` pattern for CSS variables (see `tailwind.config.ts`)
- Use `cn()` for conditional classes
- Follow component composition patterns

### Database (Prisma)

- Use Prisma client from `src/lib/db.ts`
- Apply schema changes with `npm run db:push`
- Open Prisma Studio with `npm run db:studio`

### API Response Format

```typescript
// Success
return NextResponse.json(data)

// Success with status
return NextResponse.json(data, { status: 201 })

// Error
return NextResponse.json({ error: 'Human readable message' }, { status: 400/404/500 })
```

## Key Dependencies

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5
- **Database**: SQLite via Prisma
- **Styling**: Tailwind CSS + shadcn/ui components
- **State**: Zustand + React Context
- **Auth**: iron-session
- **Validation**: Built-in Next.js body parsing

## Configuration Files

- `next.config.js` - Next.js config (standalone output for Docker)
- `tailwind.config.ts` - Tailwind with CSS variables and custom theme
- `tsconfig.json` - TypeScript with strict mode and path aliases
