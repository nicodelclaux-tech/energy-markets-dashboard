---
name: news-intelligence
description: 'Use for news ingestion, ranking, topic tagging, country relevance, editorial summarization, and decisions about how market news should be scored and presented.'
argument-hint: 'Describe the news ranking or presentation problem'
---

# News Intelligence

## When to Use

- Editing news adapters or ranking logic.
- Reworking topic or country tagging.
- Improving the dashboard news panel and relevance scoring.

## Procedure

1. Keep ingestion and enrichment logic explicit and testable.
2. Preserve explainable ranking factors where practical.
3. Align country and topic tags with the dashboard's coverage model.
4. Surface low-confidence or missing enrichment gracefully.

## Output

- News relevance or presentation changes with clear scoring rationale.