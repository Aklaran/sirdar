# Orchestrator Extension for Pi

Multi-agent orchestration and budget management extension for the Pi coding agent.

## Features

### Tools

- **spawn_agent** - Create and spawn sub-agents with specific tasks and budgets
- **check_agents** - List all active agents and their status
- **check_budget** - Monitor token usage and costs across agents

### Commands

- **/agents** - List and manage active agents

## Project Structure

```
~/repos/orchestrator/
├── package.json          # Package configuration with Pi extension definition
├── tsconfig.json         # TypeScript configuration (strict, ESNext)
├── vitest.config.ts      # Test configuration
├── src/
│   ├── index.ts          # Main extension entry point
│   └── types.ts          # Type definitions (TODO)
├── tests/
│   ├── unit/
│   │   └── extension.test.ts
│   └── mocks/
│       └── mock-pi.ts    # Mock ExtensionAPI for testing
└── data/                 # State persistence (gitignored)
```

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Watch mode
pnpm test:watch
```

## Installation

The extension is symlinked to Pi's extension directory:

```bash
ln -s ~/repos/orchestrator ~/.pi/agent/extensions/orchestrator
```

## Status

Currently scaffolded with placeholder implementations. All tools and commands are registered but return placeholder responses.

## Next Steps

1. Implement agent spawning logic
2. Add budget tracking and token counting
3. Create agent state persistence in `data/`
4. Add agent lifecycle management (pause, resume, terminate)
5. Implement inter-agent communication
