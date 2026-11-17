# Non-Property Content (NPC) Repository Context - Activities Funnel

Complete technical reference for NPC's role in **Activities search suggestions** to enable accurate epic research, story breakdown, and estimation.

**Scope**: This document focuses on how NPC provides location/destination search suggestions for the activities-web search experience.

## 📦 Tech Stack

**Backend (Scala)**:
- Scala 2.12.x
- Build Tool: SBT (Scala Build Tool)
- Framework: Akka HTTP (REST/HTTP server)
- JSON: Circe (serialization/deserialization)

**Search Engine**:
- ElasticSearch (ES) - Primary search index for place suggestions
- Custom ES Plugins:
  - OpenKoreanText Plugin (Korean text analysis)
  - Korean Hangul Jamo Analyzer
  - Multi-language analyzers (English, Thai, Japanese, etc.)

**Database**:
- CDB (Content Database) - MS SQL Server
- HikariCP connection pool

**Caching**:
- Couchbase (distributed cache for suggestion results)

**Testing**:
- ScalaTest (unit tests)
- Cucumber (integration tests)
- Pinto (consistent database images)

**Observability**:
- OpenTelemetry, WhiteFalcon, Kibana, Grafana

## 🗂️ Repository Structure (Activities-Relevant)

```
non-property-content/
├── api/                            # NPC API
│   └── src/main/scala/com/agoda/npc/
│       ├── Boot.scala             # Application entry point
│       └── api/routes/
│           ├── AllRoutes.scala    # Route aggregator
│           └── text/
│               └── SuggestionRoutes.scala  # /search/suggestions (ACTIVITIES-RELEVANT)
├── indexer/                        # ES index builder (runs daily)
│   └── src/main/scala/
│       └── indexing/
│           └── process/           # Index building logic
├── models/                         # Domain models
│   └── src/main/scala/com/agoda/npc/models/
│       └── text/
│           └── suggestion/
│               ├── request/
│               │   ├── SuggestionSearchRequest.scala
│               │   └── PlaceDetailRequest.scala
│               └── response/
│                   └── SearchResponse.scala
├── text/                           # Text search services
│   └── src/main/scala/com/agoda/npc/text/
│       └── search/
│           └── suggestion/
│               └── services/
│                   └── SuggestionSearchService.scala
├── sources/                        # Data sources & DB access
│   └── src/main/scala/com/agoda/npc/sources/
│       └── datasources/
│           └── agsql/
│               └── DbSources.scala  # CDB queries
└── it/                             # Integration tests
```

## 🔍 Activities Search Suggestions Flow

### The Problem NPC Solves for Activities

When users search for activities destinations in activities-web:
- **Input**: User types "bang" in search box
- **Need**: Show relevant destination suggestions (Bangkok, Bangalore, Bangsar, etc.)
- **NPC's Role**: Provide fast, relevant autocomplete suggestions from ElasticSearch

### Primary Endpoint: `/search/suggestions`

**Used by**: `activities-web` BFF → `NonPropertyContentSuggestionService`

**Method**: POST

**Request Body** (`SuggestionSearchRequest`):
```json
{
  "text": "bangkok",
  "placeDetailRequest": {
    "placeTypes": ["City", "Landmark", "Area"],
    "limit": 6
  },
  "context": {
    "origin": "SG",
    "languageId": 1,
    "platformId": 1,
    "whiteLabelToken": "agoda"
  },
  "lastSearchedContext": {
    "city": 18320
  }
}
```

**Request Parameters**:
- `text`: String - User input (e.g., "bang", "phuket", "tokyo tower")
- `placeDetailRequest`: Object
  - `placeTypes`: Array - **For activities**: `["City", "Landmark", "Area"]`
  - `limit`: Int - Max suggestions (typically 6 for activities)
- `context`: Object (required)
  - `origin`: String - User's country (e.g., "SG", "US")
  - `languageId`: Int - 1=English, 8=Thai, 14=Japanese, etc.
  - `platformId`: Int - 1=Web, 2=Mobile
  - `whiteLabelToken`: String - "agoda"
- `lastSearchedContext`: Object (optional)
  - `city`: Int - Boosts recently searched cities

**Response** (`SearchResponse`):
```json
{
  "places": [
    {
      "id": 18320,
      "name": "Bangkok",
      "type": "City",
      "country": "Thailand",
      "imageUrl": "https://pix.agoda.net/...",
      "hierarchy": {
        "city": "Bangkok",
        "region": "Bangkok Province",
        "country": "Thailand"
      },
      "coordinates": {
        "latitude": 13.7563,
        "longitude": 100.5018
      }
    },
    {
      "id": 789456,
      "name": "Chatuchak Weekend Market",
      "type": "Landmark",
      "country": "Thailand",
      "hierarchy": {
        "city": "Bangkok",
        "region": "Bangkok Province",
        "country": "Thailand"
      }
    }
  ]
}
```

### Place Types for Activities

**Relevant Types**:
- **City**: Primary destination (e.g., Bangkok, Tokyo, Paris)
- **Landmark**: Specific attractions (e.g., Eiffel Tower, Grand Palace)
- **Area**: Neighborhoods/districts (e.g., Shibuya, Patong Beach)

**Not Used for Activities** (but supported by NPC):
- Hotel, Region, Street

## 🔗 Integration with activities-web

### Data Flow: User Types → Suggestions Displayed

```
User types in activities-web search box
       ↓
Frontend (React component)
       ↓
BFF Endpoint: activities-web/Controllers/TextSearchApiController.cs
       ↓
NonPropertyContentSuggestionService.cs
       ↓ builds request with context
POST https://npc-api.agoda.is/search/suggestions
{
  "text": "bang",
  "placeDetailRequest": { "placeTypes": ["City", "Landmark", "Area"], "limit": 6 },
  "context": { "origin": "SG", "languageId": 1, "platformId": 1, "whiteLabelToken": "agoda" }
}
       ↓
NPC API (Akka HTTP)
       ↓
SuggestionRoutes.scala → SuggestionSearchService
       ↓
┌─────────────────────────────────────┐
│ 1. Validate request                 │
│ 2. Check Couchbase cache            │
│ 3. Build ElasticSearch query        │
│    - Text match on "bang"           │
│    - Filter: placeTypes in [City, Landmark, Area] │
│    - Boost by popularity            │
│ 4. Execute ES search on `place` index │
│ 5. Get top 6 matches                │
│ 6. Enrich from CDB (images, hierarchy) │
│ 7. Apply last-searched boosting     │
│ 8. Cache in Couchbase (TTL: ~15min) │
│ 9. Transform to SearchResponse      │
└─────────────────────────────────────┘
       ↓
Return JSON: { "places": [ { "id": 18320, "name": "Bangkok", ... }, ... ] }
       ↓
NonPropertyContentSuggestionService transforms to activities-web format
       ↓
Frontend displays dropdown with suggestions
       ↓
User selects "Bangkok"
       ↓
Frontend navigates to activities search page with cityId=18320
```

### NonPropertyContentSuggestionService (activities-web)

**Location**: `activities-web/src/Agoda.Cronos.Activities.Web/Services/NonPropertyContentSuggestionService.cs`

**Responsibilities**:
1. Build `SuggestionSearchRequest` with activities-specific context
2. POST to NPC `/search/suggestions`
3. Transform `SearchResponse` to frontend format
4. Filter to relevant place types (City, Landmark, Area)

**Key Logic**:
```csharp
// Simplified example
public async Task<SuggestionResponse> GetSuggestions(string searchText)
{
    var npcRequest = new
    {
        text = searchText,
        placeDetailRequest = new
        {
            placeTypes = new[] { "City", "Landmark", "Area" }, // Activities-specific
            limit = 6
        },
        context = new
        {
            origin = _userContext.Origin,
            languageId = _userContext.LanguageId,
            platformId = 1,
            whiteLabelToken = "agoda"
        },
        lastSearchedContext = new
        {
            city = _sessionService.GetLastSearchedCityId()
        }
    };

    var npcResponse = await _httpClient.PostAsync<SearchResponse>(
        "https://npc-api.agoda.is/search/suggestions",
        npcRequest
    );

    return TransformToFrontendFormat(npcResponse);
}
```

## 🔍 How NPC's Suggestion Search Works

### ElasticSearch `place` Index

**Index Content**:
- Cities, landmarks, areas, hotels, streets, regions
- Multi-language names (English, Thai, Japanese, Korean, etc.)
- Coordinates, hierarchies, popularity scores

**Index Structure (simplified)**:
```json
{
  "id": 18320,
  "name": "Bangkok",
  "name_en": "Bangkok",
  "name_th": "กรุงเทพ",
  "name_ja": "バンコク",
  "type": "City",
  "country": "Thailand",
  "popularity_score": 9500,
  "coordinates": { "lat": 13.7563, "lon": 100.5018 },
  "hierarchy": {
    "city_id": 18320,
    "region_id": 123,
    "country_id": 66
  }
}
```

**Built Daily by Indexer**:
- Runs once per day (configured schedule)
- Queries CDB for latest place data
- Applies language-specific analyzers
- Creates new index with timestamp (e.g., `place20250326`)
- Switches alias to new index

### Query Logic (SuggestionSearchService)

**Steps**:
1. **Text Matching**: ES match query on name fields with language analyzers
2. **Type Filtering**: Filter by `placeTypes` (City, Landmark, Area for activities)
3. **Relevance Boosting**:
   - Popularity score boost (high-traffic destinations ranked higher)
   - Last-searched city boost (if provided in `lastSearchedContext`)
   - Exact match boost (exact name match ranked first)
4. **Multi-Language Support**: Queries against language-specific fields based on `languageId`
5. **Limit Results**: Return top N (typically 6 for activities)

**Example ES Query (simplified)**:
```json
{
  "query": {
    "bool": {
      "must": [
        {
          "multi_match": {
            "query": "bangkok",
            "fields": ["name_en^3", "name_th^2", "name_ja", "name"],
            "type": "best_fields"
          }
        }
      ],
      "filter": [
        {
          "terms": {
            "type": ["City", "Landmark", "Area"]
          }
        }
      ]
    }
  },
  "size": 6,
  "sort": [
    { "_score": "desc" },
    { "popularity_score": "desc" }
  ]
}
```

### Caching Strategy

**Couchbase Cache**:
- **Cache Key**: Hash of (text + languageId + origin + placeTypes)
- **TTL**: ~15-30 minutes
- **Purpose**: Avoid repeated ES queries for identical searches
- **Cache Hit**: ~80%+ of production traffic

**Cache Flow**:
1. Request arrives → Generate cache key
2. Check Couchbase → If hit, return cached result
3. If miss → Query ES, enrich, cache result, return

## 📅 Indexer Process (Daily Rebuild)

**Purpose**: Keep ElasticSearch index fresh with latest CDB data

**Schedule**: Once per day (typically off-peak hours)

**Process**:
1. Query CDB for all places (cities, landmarks, etc.)
2. Transform to ES document format
3. Apply language analyzers (Korean, Thai, Japanese, etc.)
4. Bulk index to new index (e.g., `place20250326`)
5. Switch alias `place` → new index
6. Delete old indexes (keep last N)

**Test Scenarios for Activities**:
- Autocomplete for city names (Bangkok, Tokyo, Paris)
- Autocomplete for landmarks (Eiffel Tower, Grand Palace)
- Multi-language suggestions (English, Thai, Japanese)
- Last-searched city boosting
- Caching behavior

**Endpoints**:
- Local: http://localhost:9090/search/suggestions
- QA: https://npc-api-qa.agoda.is/search/suggestions
- Prod: https://npc-api.agoda.is/search/suggestions

## 📝 Similar Patterns to Reference

When implementing activities search suggestion features:

**Suggestion Routes**:
- `api/src/main/scala/com/agoda/npc/api/routes/text/SuggestionRoutes.scala` - Main `/search/suggestions` endpoint

**Search Service**:
- `text/src/main/scala/com/agoda/npc/text/search/suggestion/services/SuggestionSearchService.scala` - Core search logic

**Models**:
- `models/src/main/scala/com/agoda/npc/models/text/suggestion/request/SuggestionSearchRequest.scala` - Request model
- `models/src/main/scala/com/agoda/npc/models/text/suggestion/response/SearchResponse.scala` - Response model

**CDB Data Access**:
- `sources/src/main/scala/com/agoda/npc/sources/datasources/agsql/DbSources.scala` - Database queries

**Testing**:
- `it/src/test/` - Integration tests with Cucumber scenarios

## 🎯 Key Takeaways for Activities Development

1. **NPC's Role**: Provides fast autocomplete suggestions for activities search
2. **Place Types**: Focus on City, Landmark, Area (not Hotel, Street, Region)
3. **Integration Point**: activities-web → `NonPropertyContentSuggestionService` → NPC `/search/suggestions`
4. **Performance**: Couchbase caching (~80%+ cache hit rate) + ElasticSearch
5. **Multi-Language**: Supports English, Thai, Japanese, Korean, etc.
6. **Personalization**: Last-searched city boosting
7. **Index Updates**: Daily index rebuild via indexer (off-peak hours)

---

**Last Updated**: 2026-03-26
**Maintained By**: Platform Team
