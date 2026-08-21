# CLAUDE.md

Guidance for working in this repo.

## React component props

Destructure props in the function body, not in the parameter list. Keep the
parameter itself as a single typed `props` object, then pull fields out on
the next line — this keeps the type annotation readable instead of
interleaving it with a destructuring pattern.

```tsx
// Do this
function EditorPane(props: {
  dictionary: Map<number, DictEntry>,
  onSend: (msg: number[]) => void,
}) {
  const { dictionary, onSend } = props;
  ...
}

// Not this
function EditorPane({ dictionary, onSend }: {
  dictionary: Map<number, DictEntry>,
  onSend: (msg: number[]) => void,
}) {
  ...
}
```
