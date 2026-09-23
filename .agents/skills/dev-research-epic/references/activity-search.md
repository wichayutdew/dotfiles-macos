# Activity Search Repository Context

Complete technical reference for the activity-search repository to enable accurate epic research, story breakdown, and estimation.

## 📦 Tech Stack

**Backend (Scala)**:
- Scala 2.12.x
- Build Tool: Gradle 8.x (migrated from SBT)
- Framework: Akka HTTP (REST/HTTP server)
- GraphQL: Sangria (schema-first GraphQL)
- JSON: Circe (serialization/deserialization)
- Protocol Buffers: ScalaPB

**Caching**:
- L1 Cache: Caffeine (in-memory, hot data)
- L2 Cache: Redis (Redisson client, distributed cache)
- TTL Management: Configurable per cache type

**Database**:
- MS SQL Server (CDB - Content Database)
- JDBC connection with HikariCP pool

**Testing**:
- ScalaTest + Mockito (unit tests)
- Functional tests with test data recording
- Integration tests with devstack

**Observability**:
- OpenTelemetry (distributed tracing)
- Micrometer (metrics)
- Structured logging with context propagation

## 🗂️ Repository Structure

```
activity-search/
├── core-models/                    # Domain models & types
├── caching/                        # Cache abstractions (L1 + L2)
├── common/                         # Shared business logic
│   └── src/main/scala/com/agoda/activity/common/
│       ├── db/repositories/       # CDB & PostgreSQL data access
│       │   ├── CDBRepository.scala
│       │   └── PostgresRepository.scala
│       ├── supply/                # Supply service clients
│       ├── facade/                # Business logic facades
│       ├── transformers/          # Request/response transformers
│       └── externalapi/           # External API integrations
├── pricing/                        # Pricing calculation engine
│   ├── loyalty/                    # PointsMax, Cash+Points
│   ├── promotions/                 # Promo code application
│   └── currency/                   # Currency conversion
├── deduplication/                  # Request deduplication logic
├── server/                         # Activity Search GraphQL API
│   └── src/main/scala/com/agoda/activity/
│       ├── graphql/               # GraphQL layer
│       │   ├── schema/            # Schema definitions
│       │   │   └── StaticSchema.scala
│       │   ├── resolver/          # GraphQL resolvers
│       │   │   ├── DetailsResolver.scala
│       │   │   └── DeferredResolvers.scala
│       │   ├── validators/        # Request validators
│       │   │   ├── SearchRequestValidator.scala
│       │   │   ├── DetailsRequestValidator.scala
│       │   │   ├── AvailabilityRequestValidator.scala
│       │   │   └── CalendarRequestValidator.scala
│       │   └── fetchers/          # Data fetchers
│       ├── handler/               # Request handlers
│       │   ├── SearchHandler.scala
│       │   └── CrossSellSearchHandler.scala
│       ├── facade/                # Business logic facades
│       │   ├── SearchFacade.scala
│       │   ├── SearchFacadeV2.scala
│       │   └── SearchFacadeRouter.scala
│       ├── pipeline/              # Search pipeline pattern
│       │   ├── SearchPipeline.scala
│       │   ├── SearchPipelineStep.scala
│       │   ├── SearchPipelineFactory.scala
│       │   └── steps/             # Pipeline steps
│       │       ├── filters/       # Filter steps
│       │       └── enrichment/    # Enrichment steps
│       ├── routes/                # HTTP routes
│       │   └── GraphQLRoute.scala
│       └── transformers/          # Response transformers
├── prepare-booking-api/            # Prepare Booking REST API
├── jarvis-client/                  # Jarvis ranking service client
├── functional-test/                # End-to-end functional tests
├── activity-search-integration-test/  # Integration tests
└── prepare-booking-integration-test/  # Prepare Booking integration tests
```

## 🎨 GraphQL Operations

### Search Operation

**Query**: `search`

**Purpose**: Search activities by location, date range, filters, and sorting

**Input Parameters**:
- `cityId`: Int (required) - Destination city ID
- `checkInDate`: String (optional) - Start date (YYYY-MM-DD)
- `checkOutDate`: String (optional) - End date (YYYY-MM-DD)
- `pagination`: Object (required)
  - `offset`: Int - Starting position
  - `limit`: Int - Number of results (max 100)
- `filters`: Object (optional)
  - `categoryIds`: [Int] - Activity categories
  - `priceRange`: Object - Min/max price
  - `rating`: Float - Minimum rating
  - `supplierIds`: [Int] - Filter by supplier
- `sorting`: Enum (optional) - POPULARITY, PRICE_ASC, PRICE_DESC, RATING

**Response**:
- `activities`: Array of activity objects
  - `activityId`: Int
  - `title`: String
  - `description`: String
  - `images`: Array of image URLs
  - `pricing`: Pricing object
    - `displayPrice`: Amount + currency
    - `originalPrice`: Amount + currency (before discounts)
    - `discount`: Discount details
  - `rating`: Float
  - `reviewCount`: Int
  - `location`: Location object
  - `category`: Category object
- `totalCount`: Int - Total results matching query
- `facets`: Aggregation facets for filtering

**Example GraphQL Query**:
```graphql
query SearchActivities {
  search(
    cityId: 18320
    checkInDate: "2024-12-01"
    checkOutDate: "2024-12-02"
    pagination: { offset: 0, limit: 20 }
    filters: {
      categoryIds: [1, 2, 3]
      priceRange: { min: 0, max: 5000 }
    }
    sorting: POPULARITY
  ) {
    activities {
      activityId
      title
      pricing {
        displayPrice {
          amount
          currency
        }
      }
      rating
      reviewCount
    }
    totalCount
    facets {
      categories {
        categoryId
        name
        count
      }
    }
  }
}
```

### Other Key Operations

**Details**: `details(activityId: Int!)` - Get full activity details
**Availability**: `availability(activityId: Int!, date: String!)` - Check availability for specific date
**Calendar**: `calendar(activityId: Int!, from: String!, to: String!)` - Get availability calendar range

## 🔗 Dependencies & Integration Points

### Internal Services

**CDB (Content Database)**:
- Used for: Static activity data (titles, descriptions, images, locations)
- Protocol: JDBC (MS SQL Server)
- Cached: Yes (L1 + L2 with long TTL)

**Supply Services (External)**:
- Used for: Real-time pricing, availability, inventory
- Protocol: gRPC / REST (varies by supplier)
- Suppliers: Multiple activity suppliers aggregated
- Cached: Yes (L2 Redis with short TTL, ~5-15 mins)

**Jarvis (Ranking Service)**:
- Used for: Activity ranking, personalization
- Protocol: REST JSON
- Called via: jarvis-client module
- Impact: Affects search result ordering

**Pricing Engine**:
- Used for: Calculate final prices with loyalty, promos, currency conversion
- Location: pricing/ module
- Features:
  - PointsMax integration
  - Cash+Points calculations
  - Promotional code application
  - Multi-currency support

**Deduplication Service**:
- Used for: Prevent redundant external calls for identical requests
- Location: deduplication/ module
- Strategy: Request fingerprinting + in-flight request detection

### Data Flow

```
Frontend (activities-web)
       ↓
       GraphQL POST to /activities/graphql
       ↓
activity-search (Akka HTTP server)
       ↓
Sangria GraphQL resolver
       ↓
SearchService.search()
       ↓
┌──────┴──────────────────┐
│                         │
│ 1. Check L1 Cache       │
│    (Caffeine in-memory) │
│         ↓               │
│ 2. Check L2 Cache       │
│    (Redis)              │
│         ↓               │
│ 3. Query CDB            │
│    (Static data)        │
│         ↓               │
│ 4. Call Supply Services │
│    (Real-time pricing)  │
│         ↓               │
│ 5. Apply Pricing Engine │
│    (Loyalty, promos)    │
│         ↓               │
│ 6. Call Jarvis          │
│    (Ranking)            │
│         ↓               │
│ 7. Cache results        │
│                         │
└─────────────────────────┘
       ↓
Return GraphQL response
```

**Request Flow (Search Operation)**:
1. Frontend sends GraphQL query with search parameters
2. Akka HTTP receives request at `/activities/graphql`
3. Sangria parses GraphQL query and validates schema
4. `GraphQLRoute` routes to `SearchHandler`
5. `SearchHandler` validates request via `SearchRequestValidator`
6. `SearchFacade` (or `SearchFacadeV2`) orchestrates the search
7. **Deduplication check**: If identical request in-flight, await result
8. **L1 Cache lookup** (Caffeine): Check for cached search results
9. **L2 Cache lookup** (Redis): If L1 miss, check distributed cache
10. **SearchPipeline execution**: Run pipeline steps
    - **CDB Query**: Fetch static activity data (titles, images, locations)
    - **Supply Services call**: Get real-time pricing and availability
    - **Pricing Engine**: Apply loyalty programs, promos, currency conversion
    - **Jarvis ranking**: Apply personalization and ranking logic
    - **Filter steps**: Apply category, price, rating filters
    - **Enrichment steps**: Add additional data
11. **Aggregation**: Combine all data sources, generate facets
12. **Transformation**: Transform to GraphQL response format
13. **Cache results**: Store in L1 + L2 with appropriate TTLs
14. **Return response**: GraphQL response with activities + facets

**Caching Strategy**:
- **L1 (Caffeine)**: Hot data, TTL ~5 mins, per-instance cache
- **L2 (Redis)**: Shared cache, TTL ~15 mins, cross-instance
- **CDB data**: Long TTL (~1 hour), rarely changes
- **Supply data**: Short TTL (~5-15 mins), frequent price changes
- **Cache keys**: Type-safe keys with versioning (invalidation strategy)

## 🔍 Search Flow Details

### Search Pipeline Architecture

**SearchPipeline** orchestrates the search flow using a pipeline pattern with steps:

1. **Input Validation**:
   - Validate cityId, dates, pagination params
   - Normalize filters and sorting options
   - Apply rate limiting per user/IP

2. **Data Aggregation**:
   - Parallel fetching from multiple sources
   - CDB: Static activity metadata
   - Supply: Real-time pricing and availability
   - Jarvis: Ranking signals

3. **Filtering**:
   - Apply category filters
   - Price range filtering (post-pricing calculation)
   - Rating and review count thresholds
   - Availability filtering (if dates provided)

4. **Sorting**:
   - POPULARITY: Jarvis ranking score
   - PRICE_ASC/DESC: By final calculated price
   - RATING: By average user rating

5. **Pagination**:
   - Apply offset and limit
   - Return total count for pagination UI

6. **Facet Generation**:
   - Category facets (with counts)
   - Price range buckets
   - Rating distribution
   - Supplier facets

### Similar Patterns to Reference

When implementing new features, reference existing patterns:

**Search & Filtering:**
- `server/src/main/scala/com/agoda/activity/handler/SearchHandler.scala` - Main search handler
- `server/src/main/scala/com/agoda/activity/facade/SearchFacade.scala` - Search orchestration
- `server/src/main/scala/com/agoda/activity/facade/SearchFacadeV2.scala` - Search facade V2
- `server/src/main/scala/com/agoda/activity/pipeline/SearchPipeline.scala` - Search pipeline pattern
- `server/src/main/scala/com/agoda/activity/pipeline/steps/filters/ApplySearchFiltersStep.scala` - Filter application
- `server/src/main/scala/com/agoda/activity/validator/SearchRequestValidator.scala` - Request validation

**Data Fetching:**
- `common/src/main/scala/com/agoda/activity/common/db/repositories/CDBRepository.scala` - CDB data access
- `common/src/main/scala/com/agoda/activity/common/supply/` - Supply service clients
- `jarvis-client/src/main/scala/` - Jarvis ranking service client

**Caching:**
- Reference caching module for cache abstractions (L1 Caffeine + L2 Redis)
- Type-safe cache keys with versioning
- Multi-level caching with configurable TTLs

**Pricing:**
- `pricing/` module - Pricing calculation engine
- Loyalty program integration (PointsMax, Cash+Points)
- Promotional code application
- Currency conversion logic

**GraphQL Layer:**
- `server/src/main/scala/com/agoda/activity/graphql/schema/StaticSchema.scala` - Schema definitions
- `server/src/main/scala/com/agoda/activity/graphql/resolver/DetailsResolver.scala` - Details resolver
- `server/src/main/scala/com/agoda/activity/graphql/validators/` - Request validators
- `server/src/main/scala/com/agoda/activity/routes/GraphQLRoute.scala` - GraphQL HTTP route

**Request/Response Transformation:**
- `server/src/main/scala/com/agoda/activity/transformers/response/SearchActivityResultTransformer.scala` - Response transformation
- `common/src/main/scala/com/agoda/activity/common/transformers/` - Common transformers

**Testing:**
- `server/src/test/scala/` - Unit tests with ScalaTest
- `functional-test/src/test/scala/` - E2E functional tests
- `functional-test-common/src/main/scala/` - Test utilities and test case recorder

## 🧪 Testing

**Unit Tests**:
```bash
./gradlew :server:test                  # All server unit tests
./gradlew :common:test                  # Common module tests
./gradlew test                          # All unit tests
```

**Functional Tests**:
```bash
./gradlew :functional-test:test                              # All functional tests
./gradlew :functional-test:test --tests "*AllFunctionalSpec*"  # Specific suite
```

**Integration Tests**:
```bash
./gradlew :activity-search-integration-test:test  # Integration tests
```

**Test Conventions**:
- Test files: `*Spec.scala` (ScalaTest)
- Location: `src/test/scala/` parallel to source
- Mocking: Mockito for external dependencies
- Test data: Recorded in `functional-test/src/test/resources/`

## 🚀 Development

**Run Locally**:
```bash
# Option 1: Command line
./gradlew :server:run

# Option 2: IntelliJ with devstack
./gradlew clean :server:installDist
devstack --config server/devstack/devstack.yaml deploy --build --wait
# Run LocalBoot configuration in IntelliJ
```

**Endpoints**:
- Local: http://localhost:8084/activities/graphiql
- QA: https://activity-search-qa.privatecloud.qa.agoda.is/activities/graphiql
- Prod: https://activity-search-production.privatecloud.hk.agoda.is/activities/graphiql

**Key Commands**:
```bash
./gradlew clean build           # Full build
./gradlew spotlessApply         # Format code
./gradlew spotlessCheck         # Check formatting
./gradlew test jacocoTestReport # Test with coverage
```

## 📝 Note on Search Suggestions

**Search suggestions are NOT provided by activity-search**. Text search autocomplete/suggestions come from:

**NPC (Non-Property Content) API**:
- Service: Separate microservice for content suggestions
- Called from: activities-web BFF (NonPropertyContentSuggestionService)
- Protocol: REST JSON
- Endpoint: `/search/`
- Purpose: Location, activity name autocomplete

**Flow for suggestions**:
```
User types in search box
       ↓
activities-web frontend
       ↓
activities-web BFF (NonPropertyContentSuggestionService)
       ↓
NPC API (/search/)
       ↓
Returns suggestion list
       ↓
Frontend displays suggestions
```

activity-search is **NOT involved** in the suggestion flow. It only receives the final search query after the user selects or enters a complete search term.

---

**Last Updated**: 2026-03-26
**Maintained By**: Activities Team
