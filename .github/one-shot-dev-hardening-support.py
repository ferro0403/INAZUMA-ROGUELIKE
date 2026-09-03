from pathlib import Path

helper = Path('tests/helpers/production-runtime.js')
source = helper.read_text()
old = '    location: { search: "" }, document, window: null, localStorage: storage, performance: { now: () => 1000 },'
new = '    location: { search: options.locationSearch || "" }, document, window: null, localStorage: storage, performance: { now: () => 1000 },'
if old not in source:
    raise SystemExit('production-runtime location anchor not found')
helper.write_text(source.replace(old, new, 1))

app = Path('js/app.js')
source = app.read_text()
old = '      inventoryModel, ensureCurrentZoneMutation,\n'
new = '      inventoryModel, ensureCurrentZoneMutation, devSkipCurrentBoss, devSkipToCompletedBosses, devGameOverNow,\n'
if old not in source:
    raise SystemExit('terminalApi anchor not found')
app.write_text(source.replace(old, new, 1))
