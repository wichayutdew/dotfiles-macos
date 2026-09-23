# Chrome Recorder JSON Specification

## Overview

Chrome DevTools Recorder exports user flows as JSON. This document describes the format and how to parse it.

## Basic Structure

```json
{
  "title": "Recording Title",
  "steps": [
    {
      "type": "setViewport",
      "width": 1920,
      "height": 1080
    },
    {
      "type": "navigate",
      "url": "https://example.com"
    },
    {
      "type": "click",
      "target": "main",
      "selectors": [
        ["aria/Button"],
        ["#submit-button"]
      ],
      "offsetX": 100,
      "offsetY": 50
    }
  ]
}
```

## Step Types

### navigate
```json
{
  "type": "navigate",
  "url": "https://hkg.agoda.com/activities/detail?activityId=1252815",
  "assertedEvents": [
    {
      "type": "navigation",
      "url": "https://hkg.agoda.com/activities/detail?activityId=1252815",
      "title": "Activity Title"
    }
  ]
}
```

### click
```json
{
  "type": "click",
  "target": "main",
  "selectors": [
    ["aria/Add to Cart"],
    ["#add-to-cart-button"]
  ],
  "offsetX": 100,
  "offsetY": 50,
  "button": "primary"
}
```

### change (input field)
```json
{
  "type": "change",
  "target": "main",
  "selectors": [
    ["aria/Search"],
    ["input[name='search']"]
  ],
  "value": "Bangkok tours"
}
```

### keyDown / keyUp
```json
{
  "type": "keyDown",
  "target": "main",
  "key": "Enter"
}
```

### scroll
```json
{
  "type": "scroll",
  "target": "main",
  "x": 0,
  "y": 500
}
```

### waitForElement
```json
{
  "type": "waitForElement",
  "selectors": [
    ["aria/Loading complete"],
    [".loading-indicator[style*='display: none']"]
  ],
  "timeout": 5000
}
```

## Parsing Strategy

1. **Extract URLs**: Collect all `navigate` steps → extract activityIds
2. **Identify Actions**: Map `click`, `change`, `scroll` to meaningful test steps
3. **Detect Waits**: Convert `waitForElement` to Playwright `waitForSelector`
4. **Infer Intent**: 
   - Multiple navigates to same activity with different params → A/B test
   - Clicks on "Add to Cart" → purchase flow test
   - Scrolls → testing content below fold

## Conversion to Playwright

### Navigate
```typescript
await page.goto(step.url, { waitUntil: 'networkidle' });
```

### Click
```typescript
// Use first valid selector
const selector = step.selectors.flat()[0];
await page.click(selector);
```

### Change (Input)
```typescript
await page.fill(selector, step.value);
```

### Wait
```typescript
await page.waitForSelector(selector, { timeout: step.timeout || 30000 });
```

### Add Screenshots
After key actions, add:
```typescript
await page.screenshot({ path: `media/step_${index}.png` });
```

## Example Recorded Flow

User recording: "Test activity detail page → Add to cart → Checkout"

```json
{
  "title": "Activity Purchase Flow",
  "steps": [
    {
      "type": "setViewport",
      "width": 1920,
      "height": 1080
    },
    {
      "type": "navigate",
      "url": "https://hkg.agoda.com/activities/detail?activityId=1252815&cityId=2656&explist=ACTD-370=A"
    },
    {
      "type": "waitForElement",
      "selectors": [["[data-testid='activity-title']"]],
      "timeout": 5000
    },
    {
      "type": "click",
      "selectors": [["aria/Add to Cart"], ["button[data-testid='add-to-cart']"]]
    },
    {
      "type": "waitForElement",
      "selectors": [["[data-testid='cart-modal']"]],
      "timeout": 3000
    },
    {
      "type": "click",
      "selectors": [["aria/Proceed to Checkout"]]
    }
  ]
}
```

Converted Playwright:
```typescript
await page.goto('https://hkg.agoda.com/activities/detail?activityId=1252815&cityId=2656&explist=ACTD-370=A');
await page.waitForSelector('[data-testid="activity-title"]');
await page.screenshot({ path: 'media/1252815_A_detail.png' });

await page.click('button[data-testid="add-to-cart"]');
await page.waitForSelector('[data-testid="cart-modal"]');
await page.screenshot({ path: 'media/1252815_A_cart.png' });

await page.click('text=Proceed to Checkout');
```
