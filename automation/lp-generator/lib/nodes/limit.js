// OOM-Schutz: pro Lauf nur EINE Kombination bauen (LangChain-Nodes sind speicherhungrig).
// WICHTIG: pairedItem MUSS erhalten bleiben, sonst verlieren nachgelagerte
// Nodes (z. B. AI Texte) die .item-Zuordnung (Can-not-determine-which-item).
// MAX muss zum Node 'Rest offen? (erz.)' passen. Auto-Nachlauf baut den Rest.
const MAX = 1;
const items = $input.all().slice(0, MAX);
return items.map((it, i) => ({ json: it.json, binary: it.binary, pairedItem: { item: i } }));

