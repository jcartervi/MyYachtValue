# Overview

This is a HullPrice boat valuation application that provides instant estimates for vessel values. The application consists of a React frontend with a modern UI built using shadcn/ui components, and a Node.js/Express backend with PostgreSQL database integration. The system collects vessel details through a multi-step form, generates AI-powered estimates using a rules-based estimator service, and integrates with third-party services like Twilio for SMS notifications and Pipedrive for CRM functionality.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The frontend is built as a Single Page Application (SPA) using React 18 with TypeScript. The application uses Vite for build tooling and development server, providing fast hot-reload capabilities. The UI is constructed with shadcn/ui components built on top of Radix UI primitives, styled with Tailwind CSS for a consistent design system.

Key architectural decisions:
- **Component-based architecture**: Modular React components for reusability and maintainability
- **Form handling**: React Hook Form with Zod validation for type-safe form management
- **State management**: TanStack Query for server state management and local React state for UI state
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: Tailwind CSS with CSS custom properties for theme consistency

The frontend follows a multi-step form pattern with progress indication, form persistence using localStorage, and responsive design for mobile compatibility.

## Backend Architecture
The backend uses Express.js with TypeScript, implementing a REST API architecture. The server handles form submissions, data validation, estimate generation, and integrations with external services.

Key architectural decisions:
- **Express.js framework**: Lightweight and flexible web framework
- **Middleware-based architecture**: Rate limiting, CORS, error handling, and request logging
- **Service layer pattern**: Separate services for estimator, Twilio, Pipedrive, and Turnstile
- **Repository pattern**: Storage abstraction with both in-memory and database implementations
- **Validation layer**: Zod schemas for request/response validation

## Data Storage
The application uses PostgreSQL as the primary database with Drizzle ORM for type-safe database operations. The database schema includes tables for leads, vessels, estimates, and lead activities.

Key architectural decisions:
- **PostgreSQL**: Reliable relational database for structured data
- **Drizzle ORM**: Type-safe SQL query builder with TypeScript integration
- **UUID primary keys**: Distributed-friendly unique identifiers
- **Timestamp tracking**: Created/updated timestamps for audit trails
- **JSON fields**: Flexible storage for complex data like comparables and UTM parameters

## Authentication and Security
The application implements several security measures including rate limiting, CORS protection, and Cloudflare Turnstile for bot protection.

Security features:
- **Rate limiting**: IP-based rate limiting for API endpoints
- **CORS configuration**: Controlled cross-origin resource sharing
- **Input validation**: Server-side validation using Zod schemas
- **Bot protection**: Cloudflare Turnstile integration
- **Data sanitization**: Secure handling of user input

# External Dependencies

## Third-party Services
- **Neon Database**: Serverless PostgreSQL hosting for production database
- **Cloudflare Turnstile**: Bot protection and CAPTCHA service for form submissions
- **Twilio**: SMS messaging service for lead notifications and follow-up communications
- **Pipedrive**: CRM integration for lead management and sales pipeline tracking

## Core Dependencies
- **React 18**: Frontend framework with modern hooks and concurrent features
- **Express.js**: Backend web framework for Node.js
- **Drizzle ORM**: TypeScript-first ORM for PostgreSQL
- **shadcn/ui**: Component library built on Radix UI primitives
- **Tailwind CSS**: Utility-first CSS framework for styling
- **TanStack Query**: Data fetching and caching library for React
- **Zod**: TypeScript-first schema validation library
- **React Hook Form**: Performant forms library with validation support

## Development Tools
- **Vite**: Fast build tool and development server
- **TypeScript**: Type safety across frontend and backend
- **ESBuild**: Fast JavaScript bundler for production builds
- **PostCSS**: CSS processing with Tailwind CSS integration