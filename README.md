# EasyReview API

NestJS backend for EasyReview.

## Project setup

```bash
yarn install
```

Copy `.env.example` to `.env.staging` / `.env.production` and fill in values.

## Run

```bash
# Staging (watch mode)
yarn staging

# Production (compiled)
yarn build
yarn prod
```

Server starts at `http://localhost:3000`.

## Health check

```bash
curl http://localhost:3000/health
```

## Scripts

| Script | Description |
|--------|-------------|
| `yarn staging` | Run with `NODE_ENV=staging` (watch mode) |
| `yarn production` | Run with `NODE_ENV=production` |
| `yarn build` | Build for production |
| `yarn prod` | Run compiled production build |
| `yarn lint` | Lint and fix TypeScript files |
| `yarn prisma:generate` | Generate Prisma client |
| `yarn prisma:migrate` | Run Prisma migrations |
| `yarn prisma:studio` | Open Prisma Studio |
