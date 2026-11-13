# Workshop layout

Move the Workshop down one row, then drag its right edge one column farther. The other cards should stay in place.

```grid
{
  "id": "workshop-layout",
  "rows": [
    "Row 1",
    "Row 2",
    "Row 3",
    "Row 4",
    "Row 5",
    "Row 6"
  ],
  "columns": [
    {
      "label": "A"
    },
    {
      "label": "B"
    },
    {
      "label": "C"
    },
    {
      "label": "D"
    }
  ],
  "cards": [
    {
      "id": "workshop",
      "title": "Workshop",
      "row": 1,
      "column": 1,
      "rowSpan": 2,
      "columnSpan": 2,
      "color": "purple",
      "details": "Spans two rows and two columns."
    },
    {
      "id": "supplies",
      "title": "Supplies",
      "row": 1,
      "column": 4,
      "rowSpan": 2,
      "columnSpan": 1,
      "color": "orange"
    },
    {
      "id": "break",
      "title": "Break",
      "row": 5,
      "column": 2,
      "rowSpan": 1,
      "columnSpan": 2,
      "color": "green"
    }
  ]
}
```
