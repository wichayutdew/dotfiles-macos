# Activities Web - URL Pattern Configuration

## Repository Info
- **Repository**: activities-web
- **Project**: Activities
- **Base URL (Production)**: https://hkg.agoda.com

## URL Patterns

### Detail Page URL Format

```
{base_url}/activities/detail?activityId={id}&cityId={city}&explist={exp}={variant}
```

**Placeholders:**
- `{base_url}`: Production base URL (https://hkg.agoda.com)
- `{id}`: Activity ID
- `{city}`: City ID
- `{exp}`: Experiment ID (e.g., ACTD-489)
- `{variant}`: Experiment variant (A or B)

**Example:**
```
https://hkg.agoda.com/activities/detail?activityId=1252815&cityId=9395&explist=ACTD-489=A
https://hkg.agoda.com/activities/detail?activityId=1252815&cityId=9395&explist=ACTD-489=B
```

### Multi-Experiment Format

When testing multiple experiments simultaneously:
```
{base_url}/activities/detail?activityId={id}&cityId={city}&explist={exp1}={variant1},{exp2}={variant2}
```

**Example:**
```
https://hkg.agoda.com/activities/detail?activityId=1252815&cityId=9395&explist=ACT-5017=A,ACTD-489=B
```

## Anti-Patterns

❌ **Do NOT use search page URLs** - These are for browsing, not testing specific entities:
```
https://hkg.agoda.com/activities/search?...
```

❌ **Do NOT use list page URLs** - These don't show entity-specific behavior:
```
https://hkg.agoda.com/activities/list?...
```

✅ **Always use detail page URLs** - These show entity-specific functionality and experiments:
```
https://hkg.agoda.com/activities/detail?activityId={id}&cityId={city}&explist={exp}={variant}
```

## Category-Specific Notes

### Date Landing Behavior (ACTD-489)

For experiments affecting date landing behavior, test with activities from different main categories:

**Categories affected (default tomorrow):**
- Experiences
- Tours
- Food & Drinks
- Travel Essentials

**Other categories (default today):**
- All other main categories

When testing ACTD-489 specifically, ensure test activities span both category groups.
