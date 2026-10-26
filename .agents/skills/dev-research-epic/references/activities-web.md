# Activities Web Repository Context

Complete technical reference for the activities-web repository to enable accurate epic research, story breakdown, and estimation.

## 📦 Tech Stack

**Frontend**:
- React 18.3.1 + TypeScript 5.9.3
- State: Redux Toolkit + RTK Query
- Styling: DroneJS design system, styled-components v6
- Testing: Jest (unit), Playwright (E2E, visual, accessibility)
- Bundler: Rspack (webpack alternative)

**Backend (.NET BFF)**:
- .NET 8.0 / ASP.NET Core
- Cronos Bootstrap framework (Agoda internal)
- YARP reverse proxy
- Razor views for SSR

**Build & Tools**:
- pnpm for frontend packages
- dotnet for backend build
- ESLint + Prettier for linting

## 🗂️ Repository Structure

```
activities-web/
└── src/
    ├── Agoda.Cronos.Activities.Web/              # .NET Backend (BFF)
    │   ├── Controllers/
    │   │   └── TextSearchApiController.cs
    │   └── Services/
    │       ├── NonPropertyContentSuggestionService.cs
    │       ├── SuggestionSearchRequestBuilder.cs
    │       ├── TextSearchRenderResponseBuilder.cs
    │       └── ActivitiesSuggestionSearchRequestBuilder.cs
    │
    └── Agoda.Cronos.Activities.ClientSide/       # Frontend (React/TypeScript)
        └── src/
            ├── component/                        # Reusable UI components
            │   ├── common/                       # Shared components
            │   │   ├── SearchBox/
            │   │   │   ├── SearchBox.tsx
            │   │   │   ├── SearchBox.selectors.ts
            │   │   │   ├── SearchBoxPopover.tsx
            │   │   │   └── SearchBoxPopover.selectors.ts
            │   │   ├── SearchBar/
            │   │   │   ├── SearchBar.tsx
            │   │   │   └── SearchBar.selectors.tsx
            │   │   ├── SuggestionItem/
            │   │   │   └── SuggestionItem.tsx
            │   │   └── TextSearch/
            │   │       ├── OverlayTextSearchInput.tsx
            │   │       ├── suggestionUtils.ts
            │   │       ├── TextSearchDropdown.tsx
            │   │       ├── TextSearchDropdown.selectors.ts
            │   │       ├── TextSearchOverlay.tsx
            │   │       └── TextSearchOverlay.selectors.ts
            │   │
            │   ├── page/                         # Page-specific components
            │   │    ├── home/                    # Home page components
            │   │    └── search/                  # Search page components
            │   │        └── Search/
            │   │           └── SearchPage.tsx
            │   └── store/
            │       └── api
            │           └── activitiesGqlApi.ts
            └── gql/                              # GraphQL queries & mutations
                └── activityBuilder/
                    └── search/
                        ├── query/
                        │   └── queryGenerator.ts
                        └── variables/
                            └── variablesGenerator.ts
```

## 🎨 Patterns & Conventions

### Component Structure

```typescript
// Standard component structure
component/
├── ComponentName/
│   ├── ComponentName.tsx           # Main component
│   ├── ComponentName.selectors.ts  # Selector of main component
│   ├── ComponentName.test.tsx      # Unit tests

// Component conventions
- Use functional components with hooks
- Use TypeScript interfaces for props
- Use data-testid attributes for testing
- Components should be small and focused (single responsibility)
```

### API Integration

**GraphQL API Pattern:**
```typescript
// Frontend uses axios for GraphQL API calls
// API layer: store/api/activitiesGqlApi.ts
// Automatic retry logic: 3 attempts (initial + 2 retries) with delays of 1000ms, 1000ms, 4000ms

import queryActivitiesGqlApi from 'store/api/activitiesGqlApi';

// Endpoint: ${webgateUrl}/graphql (proxied via BFF)
queryActivitiesGqlApi({
  args: {
    props: {
      searchType,
      searchRequestType,
      pagination: { number: pageNumber, size: paginationSize },
      keyword,
    },
  },
  operation: ActivityGqlOperation.search,
  key: OperationKey.Search,
});
```

**Redux State Management:**
- Redux Toolkit for state management
- Store structure: api, bootstrap, search, details, home, availability, overlay, etc.
- Selectors: Use `createSelector` for memoization
- State updates: Dispatched after API responses

### Styling

```typescript
// Use DroneJS design system
import { Container, Button, Input, Card } from '@agoda/drone-js';
//data-testid is for unit test/feature test, data-element-name is for analytic
<Container data-testid="component-name" data-element-name="component-name">
  <Button variant="primary">Search</Button>
</Container>
```

## 🔗 Dependencies & Integration Points

### Internal Services

**Drone-JS Design System**:
- Used for: UI components, multi-brand theming
- Package: `@drone-js/*` (styled-components v6)

**activity-search** (Activities API):
- Used for: Activity list, details, pricing, availability
- Protocol: GraphQL
- Endpoint: `/activities/graphql` (proxied via BFF)
- Queries: search, details, calendar, reviews

**non-property-content** (NPC API):
- Used for: Text search suggestions, autocomplete
- Protocol: REST JSON
- Endpoint: `/search/`
- Called from: BFF .NET service (NonPropertyContentSuggestionService)

### Data Flow

```
User → React Frontend
       ↓
       Component dispatches action
       ↓
       queryActivitiesGqlApi() - store/api/activitiesGqlApi.ts
       ↓
       axios POST to ${url}/graphql
       ↓
       .NET BFF (ASP.NET Core 8.0)
       ↓
       Backend Services:
       ├→ activity-search (GraphQL) - Activity data
       ├→ NPC API (REST) - Text search suggestions
       └→ Other services (CAPI, Cart, etc.)
```

**Request Flow:**
1. React component calls `queryActivitiesGqlApi({ operation, args, key })`
2. Builds GraphQL payload with query + variables
3. axios POST to `${url}/graphql` with headers
4. **Retry logic:** 3 total attempts (initial + 2 retries)
   - Delays: 1000ms, 1000ms, 4000ms
   - Conditions: Network errors, incomplete responses, 5xx errors
5. BFF receives request, proxies to backend services
6. Backend services return data
7. Frontend receives response, dispatches Redux action
8. Redux state updates with new data
9. React components re-render

### Similar Features to Reference

When implementing new features, reference existing patterns in these components:

**Search & TextSearch:**
- `component/common/SearchBox/` - Search input on pages (Search, Home)
- `component/common/TextSearch/` - Search input inside overlay/dropdown
- `component/common/SuggestionItem/` - Suggestion list rendering
- `component/page/search/Search/` - Search results page

**Data Fetching:**
- `gql/activityBuilder/search/` - GraphQL query generation
  - `query/queryGenerator.ts` - Build GraphQL queries
  - `variables/variablesGenerator.ts` - Build query variables
- `gql/activityBuilder/details/` - Details query pattern
- `store/api/activitiesGqlApi.ts` - Main API layer with retry logic

**Redux State Management:**
- `store/slice/search/` - Search state management
- `store/slice/details/` - Details state management
- `store/slice/home/` - Home page state

---

**Last Updated**: 2026-03-26
**Maintained By**: Activities Team