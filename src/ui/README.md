# Shared building blocks

Every panel, card, list and dialog of the GUI is made of these, so they look and behave alike. Use them for anything
new instead of styling buttons and inputs again.

- `theme.ts`: the colours (`accent` orange is "picked / on", `go` green is "add / confirm", `danger` red is "delete"),
  corners, shadow and type sizes. Change the look here.
- `Button`: `$variant` `plain`, `go`, `accent`, `danger` (outlined until pointed at), `ghost` (a fold arrow, a ×).
- `CardShell` + `CardHead` + `CardTabs`: a card over a view. Place it with `styled(CardShell)` (top/left/right/bottom
  only); the head has the title, a subtitle, a fold arrow and actions; the tabs are Radix tabs (arrow keys work).
  Put the card's content in `<div className="body">`.
- `Field`: a label, its box or select, and a unit, lined up down the card.
- `About` (a tab's explanation), `Tip` (under fields), `Status` (what happened, why not), `Section` (a heading),
  `Check` (a checkbox and its text), `Actions` + `Gap` (buttons at the bottom: left of the gap, right of it),
  `List` + `ListRow` (things to point at and pick), `Chips` (small buttons after a label).
- `Dialog`: a Radix dialog with a title and the × (focus stays inside, Escape and a click beside it close it). Its
  body uses `label.field`, `.controls`, `.hint`, `.note` and a `.buttons` row with `button.add` / `button.danger`.

Example:

```tsx
const Card = styled(CardShell)`top: 0.75rem; right: 0.75rem;`;

<Card>
    <CardHead title="usb" subtitle="default_usb.kicad_pcb" folded={folded} onFold={setFolded}/>
    {!folded && <div className="body">
        <Field label="Shift X" unit="mm"><input value={x} onChange={…}/></Field>
        <Tip>←↑→↓ move it 0.1 mm.</Tip>
        <Actions><Button onClick={deselect}>Deselect</Button><Gap/><Button $variant="danger" onClick={remove}>Delete</Button></Actions>
    </div>}
</Card>
```
